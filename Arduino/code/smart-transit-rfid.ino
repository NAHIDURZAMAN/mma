#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ESP8266mDNS.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SoftwareSerial.h>
#include <Servo.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
SoftwareSerial rdm6300(D5, D6); // RX, TX (TX unused)
Servo myServo;

const int buzzerPin = D8; // Buzzer pin

// WiFi credentials
const char *ssid = "Tushar";
const char *password = "12345678";

// Server configuration
const char *serverHostname = "smarttransit.local"; // mDNS hostname
String serverIP = "";                               // Will be resolved via mDNS
const int serverPort = 2000;
const char *endpoint = "/api/rfid/scan";

// Bus location data
struct BusLocation
{
    double latitude;
    double longitude;
    String locationName;
} busLocation;

// Bus capacity and passenger tracking
const int totalSeats = 40;       // Bus এর মোট আসন
int currentPassengers = 0;       // বর্তমান যাত্রী সংখ্যা
int availableSeats = totalSeats; // বাকি আসন
unsigned long lastStatusUpdate = 0;
const unsigned long statusUpdateInterval = 5000; // 5 seconds

// RFID scanning variables
String rfidData = "";
String lastCardID = "";
String currentCardID = "";
unsigned long lastScanTime = 0;
unsigned long cardDetectionTime = 0;
unsigned long lastSuccessfulScanTime = 0;
const unsigned long scanDelay = 2000;            // 2 seconds between ANY scans
const unsigned long cardReadWindow = 1000;       // 1 second window to collect card data
const unsigned long absoluteDebounceTime = 3000; // 3 seconds absolute minimum between server requests
bool isProcessing = false;                       // Flag to prevent multiple processing
bool cardPresent = false;                        // Track if card is currently being read
int consecutiveReads = 0;                        // Count consecutive reads of same card
const int minConsecutiveReads = 3;               // Minimum reads to confirm valid card
bool cardValidated = false;                      // Track if current card has been validated
String validatedCardID = "";                     // Store the validated card ID

WiFiClient wifiClient;
HTTPClient http;

// Forward declarations
void connectToWiFi();
void initializeBusLocation();
bool resolveMDNS();
String extractCardID(String data);
void handleCardRead(String cardID);
void processValidCard(String cardID);
void sendCardToServer(String cardID);
void handleServerResponse(StaticJsonDocument<500> &doc);
void successBeep();
void errorBeep();
void openGate();
void displayError(String line1, String line2);
void getBusStatusFromServer();
void updateBusStatusDisplay();
void showTemporaryMessage(String line1, String line2);

// Initialize bus location
void initializeBusLocation()
{
    busLocation.latitude = 23.7465;
    busLocation.longitude = 90.3765;
    busLocation.locationName = "City Terminal";
}

void setup()
{
    Serial.begin(9600);
    rdm6300.begin(9600);

    pinMode(buzzerPin, OUTPUT);
    digitalWrite(buzzerPin, LOW);

    // Initialize LCD
    lcd.begin();
    lcd.backlight();
    lcd.clear();

    // Initialize Servo
    myServo.attach(D7);
    myServo.write(0);

    // Initialize bus location
    initializeBusLocation();

    // Connect to WiFi
    connectToWiFi();

    // Resolve server IP via mDNS
    if (!resolveMDNS()) {
        displayError("mDNS Failed", "Check server");
        delay(3000);
    }

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Smart Transit");
    lcd.setCursor(0, 1);
    lcd.print("Scan your card");

    // Update bus status display every 5 seconds
    updateBusStatusDisplay();

    Serial.println("=== Smart Transit RFID Scanner Ready ===");
}

void loop()
{
    // Check WiFi connection
    if (WiFi.status() != WL_CONNECTED)
    {
        Serial.println("WiFi disconnected. Reconnecting...");
        connectToWiFi();
        return;
    }

    unsigned long currentTime = millis();

    // Update bus status display periodically
    updateBusStatusDisplay();

    // Absolute debounce - prevent ANY processing within absoluteDebounceTime
    if (isProcessing || (currentTime - lastSuccessfulScanTime) < absoluteDebounceTime)
    {
        // Clear any incoming RFID data during debounce period
        while (rdm6300.available())
        {
            rdm6300.read(); // Discard data
        }

        // Show countdown on LCD during debounce
        if ((currentTime - lastSuccessfulScanTime) < absoluteDebounceTime && lastSuccessfulScanTime > 0)
        {
            unsigned long remaining = (absoluteDebounceTime - (currentTime - lastSuccessfulScanTime)) / 1000;
            if (remaining > 0 && !isProcessing)
            {
                lcd.clear();
                lcd.setCursor(0, 0);
                lcd.print("Please Wait...");
                lcd.setCursor(0, 1);
                lcd.print("Ready in " + String(remaining) + "s");
                delay(200);
            }
        }
        return;
    }

    // Read RFID data with improved logic
    if (rdm6300.available())
    {
        char c = rdm6300.read();
        Serial.print(c, HEX); // Debug output

        if (c == 0x02)
        { // Start byte
            if (!cardPresent)
            {
                rfidData = "";
                cardDetectionTime = currentTime;
                cardPresent = true;
                consecutiveReads = 0;
                cardValidated = false;
                validatedCardID = "";
                Serial.println("\n=== NEW CARD DETECTION STARTED ===");

                // Show "Reading..." on LCD immediately
                lcd.clear();
                lcd.setCursor(0, 0);
                lcd.print("Scanning Card...");
                lcd.setCursor(0, 1);
                lcd.print("Hold steady...");
            }
            rfidData = String(c); // Start fresh with start byte
        }
        else if (cardPresent && rfidData.length() > 0)
        {
            rfidData += c;

            // Check for end byte
            if (c == 0x03 && rfidData.length() >= 14)
            {
                // End byte - complete card read
                String detectedCard = extractCardID(rfidData);
                if (detectedCard.length() == 10)
                {
                    handleCardRead(detectedCard);
                }
                else
                {
                    Serial.println("Invalid card data length");
                }
                rfidData = ""; // Reset for next read
            }
            else if (rfidData.length() > 20)
            {
                // Prevent buffer overflow
                rfidData = "";
                Serial.println("Buffer overflow protection - clearing data");
            }
        }
    }
    else
    {
        // Check if card was removed (no data for some time)
        if (cardPresent && (currentTime - cardDetectionTime) > cardReadWindow)
        {
            Serial.println("\n=== CARD DETECTION ENDED ===");

            if (cardValidated && validatedCardID.length() > 0)
            {
                // Process the validated card
                processValidCard(validatedCardID);
            }
            else if (consecutiveReads > 0)
            {
                Serial.println("Card removed before validation completed (" + String(consecutiveReads) + "/" + String(minConsecutiveReads) + ")");
                showTemporaryMessage("Scan Error", "Hold card longer");
            }

            // Reset detection state
            cardPresent = false;
            currentCardID = "";
            consecutiveReads = 0;
            cardValidated = false;
            validatedCardID = "";

            // Restore default display if not processing
            if (!isProcessing)
            {
                lcd.clear();
                lcd.setCursor(0, 0);
                lcd.print("Smart Transit");
                lcd.setCursor(0, 1);
                lcd.print("Scan your card");
            }
        }
    }
}

String extractCardID(String data)
{
    // Extract the card ID from the RFID data frame
    // Format: STX (0x02) + 10 data bytes + checksum + ETX (0x03)
    if (data.length() >= 14 && data.charAt(0) == 0x02 && data.charAt(13) == 0x03)
    {
        return data.substring(1, 11);
    }
    return "";
}

void handleCardRead(String cardID)
{
    unsigned long currentTime = millis();

    // If same card as current detection
    if (cardID == currentCardID)
    {
        consecutiveReads++;
        Serial.println("Consistent read #" + String(consecutiveReads) + "/" + String(minConsecutiveReads) + ": " + cardID);

        // Show reading progress on LCD
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Validating...");
        lcd.setCursor(0, 1);
        String progress = String(consecutiveReads) + "/" + String(minConsecutiveReads) + " " + cardID.substring(6);
        lcd.print(progress);

        // Validate card after enough consistent reads
        if (consecutiveReads >= minConsecutiveReads && !cardValidated)
        {
            cardValidated = true;
            validatedCardID = cardID;
            Serial.println("*** CARD VALIDATED: " + cardID + " ***");

            lcd.clear();
            lcd.setCursor(0, 0);
            lcd.print("Card Validated");
            lcd.setCursor(0, 1);
            lcd.print("Release to scan");
        }
    }
    else
    {
        // Different card detected - reset validation
        if (currentCardID != "")
        {
            Serial.println("Card changed from " + currentCardID + " to " + cardID + " - resetting validation");
        }
        currentCardID = cardID;
        consecutiveReads = 1;
        cardValidated = false;
        validatedCardID = "";
        Serial.println("New card detected, starting validation: " + cardID);

        // Show new card detection
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("New Card Found");
        lcd.setCursor(0, 1);
        lcd.print(cardID);
    }
}

void processValidCard(String cardID)
{
    unsigned long currentTime = millis();

    // Final safety check - ensure minimum time between scans
    if ((currentTime - lastSuccessfulScanTime) < absoluteDebounceTime)
    {
        Serial.println("BLOCKED: Too soon after last scan");
        unsigned long remaining = (absoluteDebounceTime - (currentTime - lastSuccessfulScanTime)) / 1000;
        showTemporaryMessage("Too Soon", "Wait " + String(remaining) + "s");
        return;
    }

    isProcessing = true;
    lastCardID = cardID;
    lastScanTime = currentTime;

    Serial.println("=== PROCESSING VALIDATED CARD ===");
    Serial.print("Card ID: ");
    Serial.println(cardID);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Processing...");
    lcd.setCursor(0, 1);
    lcd.print("Please wait");

    // Send to server
    sendCardToServer(cardID);
}

void connectToWiFi()
{
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Connecting WiFi");
    lcd.setCursor(0, 1);
    lcd.print("Please wait...");

    WiFi.begin(ssid, password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30)
    {
        delay(1000);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("");
        Serial.println("WiFi connected!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("WiFi Connected");
        lcd.setCursor(0, 1);
        lcd.print(WiFi.localIP());
        delay(2000);
    }
    else
    {
        Serial.println("WiFi connection failed!");
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("WiFi Failed");
        lcd.setCursor(0, 1);
        lcd.print("Check settings");
        delay(3000);
    }
}

bool resolveMDNS()
{
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Finding Server");
    lcd.setCursor(0, 1);
    lcd.print("via mDNS...");

    Serial.println("=== Starting mDNS Resolution ===");
    
    if (!MDNS.begin("esp32-rfid-scanner"))
    {
        Serial.println("Error setting up mDNS responder!");
        return false;
    }
    
    Serial.print("Resolving hostname: ");
    Serial.println(serverHostname);

    // Try to resolve the hostname
    IPAddress serverAddr = MDNS.queryHost(serverHostname);
    
    if (serverAddr == INADDR_NONE)
    {
        Serial.println("mDNS resolution failed!");
        
        // Try a few more times
        for (int i = 0; i < 3; i++)
        {
            delay(1000);
            Serial.print("Retry ");
            Serial.print(i + 1);
            Serial.print("/3: ");
            
            serverAddr = MDNS.queryHost(serverHostname);
            if (serverAddr != INADDR_NONE)
            {
                break;
            }
            Serial.println("Failed");
        }
    }
    
    if (serverAddr != INADDR_NONE)
    {
        serverIP = serverAddr.toString();
        Serial.print("✅ Server found at IP: ");
        Serial.println(serverIP);
        
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Server Found!");
        lcd.setCursor(0, 1);
        lcd.print(serverIP);
        delay(2000);
        
        return true;
    }
    else
    {
        Serial.println("❌ Failed to resolve server hostname");
        serverIP = ""; // Clear any previous IP
        return false;
    }
}

void showTemporaryMessage(String line1, String line2)
{
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(line1);
    lcd.setCursor(0, 1);
    lcd.print(line2);
    delay(800); // Reduced from 1500ms

    // Restore default display
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Smart Transit");
    lcd.setCursor(0, 1);
    lcd.print("Scan your card");
}

void sendCardToServer(String cardID)
{
    if (WiFi.status() != WL_CONNECTED)
    {
        displayError("WiFi Error", "Disconnected");
        isProcessing = false;
        return;
    }

    // Check if we have a resolved server IP
    if (serverIP == "")
    {
        Serial.println("No server IP resolved. Attempting mDNS resolution...");
        if (!resolveMDNS())
        {
            displayError("Server Error", "Not found");
            isProcessing = false;
            return;
        }
    }

    // Mark the time when we actually send the request
    unsigned long sendTime = millis();

    http.begin(wifiClient, serverIP, serverPort, endpoint);
    http.addHeader("Content-Type", "application/json");

    // Create JSON payload with location data and unique timestamp
    StaticJsonDocument<300> doc;
    doc["card_id"] = cardID;
    doc["device_id"] = "ESP8266_01";
    doc["location"] = busLocation.locationName;
    doc["latitude"] = busLocation.latitude;
    doc["longitude"] = busLocation.longitude;
    doc["timestamp"] = sendTime;
    doc["scan_id"] = String(cardID) + "_" + String(sendTime); // Unique scan identifier

    String jsonString;
    serializeJson(doc, jsonString);

    Serial.println("=== SENDING TO SERVER ===");
    Serial.println("JSON: " + jsonString);
    Serial.println("Send Time: " + String(sendTime));

    // Show sending status on LCD
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Sending...");
    lcd.setCursor(0, 1);
    lcd.print("Do not rescan!");

    int httpResponseCode = http.POST(jsonString);

    if (httpResponseCode > 0)
    {
        String response = http.getString();
        Serial.println("=== SERVER RESPONSE ===");
        Serial.print("HTTP Code: ");
        Serial.println(httpResponseCode);
        Serial.print("Response: ");
        Serial.println(response);

        // Parse response
        StaticJsonDocument<500> responseDoc;
        DeserializationError error = deserializeJson(responseDoc, response);

        if (!error)
        {
            // Mark successful scan time ONLY after successful server response
            lastSuccessfulScanTime = sendTime;
            handleServerResponse(responseDoc);
        }
        else
        {
            Serial.println("JSON Parse Error: " + String(error.c_str()));
            displayError("Parse Error", "Try again");
        }
    }
    else
    {
        Serial.println("HTTP Error Code: " + String(httpResponseCode));
        displayError("Server Error", "Code: " + String(httpResponseCode));
    }

    http.end();

    // Reset processing state
    isProcessing = false;
    cardPresent = false;
    currentCardID = "";
    consecutiveReads = 0;
    cardValidated = false;
    validatedCardID = "";

    Serial.println("=== SCAN PROCESSING COMPLETE ===");
}

void handleServerResponse(StaticJsonDocument<500> &doc)
{
    String action = doc["action"];
    String message = doc["message"];
    bool success = doc["success"];

    Serial.print("Action: ");
    Serial.println(action);
    Serial.print("Message: ");
    Serial.println(message);
    Serial.print("Success: ");
    Serial.println(success);

    // Display detailed message on LCD
    if (doc.containsKey("display"))
    {
        String line1 = doc["display"][0];
        String line2 = doc["display"][1];

        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print(line1);
        lcd.setCursor(0, 1);
        lcd.print(line2);
    }
    else if (success)
    {
        lcd.clear();
        lcd.setCursor(0, 0);
        if (message.indexOf("started") >= 0)
        {
            lcd.print("Journey Started");
            lcd.setCursor(0, 1);
            lcd.print("Welcome aboard!");
        }
        else if (message.indexOf("ended") >= 0)
        {
            lcd.print("Journey Ended");
            lcd.setCursor(0, 1);
            lcd.print("Thank you!");
        }
        else
        {
            lcd.print("Success");
            lcd.setCursor(0, 1);
            lcd.print(message.substring(0, 16));
        }
    }
    else
    {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Error:");
        lcd.setCursor(0, 1);
        lcd.print(message.substring(0, 16));
    }

    // Handle actions with improved feedback
    if (action == "success_beep" && success)
    {
        successBeep();
        openGate();

        // Update passenger count based on journey type
        if (message.indexOf("started") >= 0)
        {
            currentPassengers++; // Passenger entered
            availableSeats = totalSeats - currentPassengers;
        }
        else if (message.indexOf("ended") >= 0)
        {
            currentPassengers--; // Passenger exited
            if (currentPassengers < 0)
                currentPassengers = 0;
            availableSeats = totalSeats - currentPassengers;
        }
    }
    else if (action == "error_beep" || !success)
    {
        errorBeep();
    }
    else if (action == "no_action")
    {
        // Just display message, no beep
    }

    // Reset display after delay
    delay(2500);              // Reduced from 4000ms
    updateBusStatusDisplay(); // Show updated bus status
}

void successBeep()
{
    // Double beep for success - faster
    digitalWrite(buzzerPin, HIGH);
    delay(150); // Reduced from 200ms
    digitalWrite(buzzerPin, LOW);
    delay(50); // Reduced from 100ms
    digitalWrite(buzzerPin, HIGH);
    delay(150); // Reduced from 200ms
    digitalWrite(buzzerPin, LOW);
}

void errorBeep()
{
    // Long beep for error - shorter
    digitalWrite(buzzerPin, HIGH);
    delay(300); // Reduced from 500ms
    digitalWrite(buzzerPin, LOW);
}

void openGate()
{
    // Rotate servo 90°, wait shorter time, then back to 0°
    myServo.write(90);
    delay(1500); // Reduced from 2000ms
    myServo.write(0);
}

void displayError(String line1, String line2)
{
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(line1);
    lcd.setCursor(0, 1);
    lcd.print(line2);

    errorBeep();

    // Reset processing flag in case of error
    isProcessing = false;

    delay(1200);              // Reduced from 2000ms
    updateBusStatusDisplay(); // Show bus status instead of default
}

// Function to get current passenger count from server
void getBusStatusFromServer()
{
    // Check if we have a resolved server IP
    if (serverIP == "")
    {
        Serial.println("No server IP for status update. Skipping...");
        return;
    }

    WiFiClient client;
    HTTPClient http;

    http.begin(client, String("http://") + serverIP + ":" + String(serverPort) + "/api/current-travel");
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = http.GET();

    if (httpResponseCode == 200)
    {
        String response = http.getString();

        StaticJsonDocument<1000> doc;
        DeserializationError error = deserializeJson(doc, response);

        if (!error)
        {
            int onlineUsers = doc["count"]; // Current passengers from API
            currentPassengers = onlineUsers;
            availableSeats = totalSeats - currentPassengers;

            // Ensure we don't go negative
            if (availableSeats < 0)
                availableSeats = 0;
            if (currentPassengers > totalSeats)
                currentPassengers = totalSeats;

            Serial.println("Bus Status Updated - Passengers: " + String(currentPassengers) + ", Available: " + String(availableSeats));
        }
    }

    http.end();
}

// Function to update bus status display
void updateBusStatusDisplay()
{
    unsigned long currentTime = millis();

    // Update every 5 seconds and when not processing
    if ((currentTime - lastStatusUpdate) >= statusUpdateInterval && !isProcessing && !cardPresent)
    {
        lastStatusUpdate = currentTime;

        // Get real-time data from server
        getBusStatusFromServer();

        // Display on LCD
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("P:" + String(currentPassengers) + " A:" + String(availableSeats));
        lcd.setCursor(0, 1);

        if (availableSeats == 0)
        {
            lcd.print("BUS FULL");
        }
        else if (availableSeats <= 5)
        {
            lcd.print("Few seats left");
        }
        else
        {
            lcd.print("Seats available");
        }

        delay(2000); // Show for 2 seconds

        // Then show default scan message
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Smart Transit");
        lcd.setCursor(0, 1);
        lcd.print("Scan your card");
    }
}