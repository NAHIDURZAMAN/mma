#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SoftwareSerial.h>
#include <Servo.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);
SoftwareSerial rdm6300(D5, D6); // RX, TX (TX unused)
Servo myServo;

const int buzzerPin = D8;  // Buzzer pin

String rfidData = "";

unsigned long lastScanTime = 0;          // Timestamp of last processed card
const unsigned long scanDelay = 3000;   // 3 seconds debounce delay

void setup() {
  Serial.begin(9600);
  rdm6300.begin(9600);

  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW);

  lcd.begin();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Scan your card");

  myServo.attach(D7);  // Attach servo to pin D7
  myServo.write(0);    // Initial position 0 degrees

  Serial.println("Scan your RFID card:");
}

void loop() {
  while (rdm6300.available()) {
    char c = rdm6300.read();

    if (c == 0x02) {          // Start byte
      rfidData = "";
      rfidData += c;
    } 
    else if (rfidData.length() > 0) {
      rfidData += c;
      if (c == 0x03) {       // End byte
        parseCardID(rfidData);
        rfidData = "";
      }
    }
  }
}

void parseCardID(String data) {
  if (data.length() >= 14) {
    unsigned long now = millis();
    if (now - lastScanTime < scanDelay) {
      // Ignore repeated scans within debounce period
      return;
    }
    lastScanTime = now;

    String cardID = data.substring(1, 11);
    Serial.print("Card ID: ");
    Serial.println(cardID);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Card Detected:");
    lcd.setCursor(0, 1);
    lcd.print(cardID);

    // Buzzer beep: ON 200ms, then OFF
    digitalWrite(buzzerPin, HIGH);
    delay(200);
    digitalWrite(buzzerPin, LOW);

    // Rotate servo 90°, wait 2 sec, then back to 0°
    myServo.write(90);
    delay(2000);
    myServo.write(0);
  } 
  else {
    Serial.println("Invalid data received");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Invalid Data");
  }
}