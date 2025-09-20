import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    socketTimeout: 60000,
    connectionTimeout: 60000,
  })
}

// HTML email template for journey start
const getJourneyStartTemplate = (user, journeyData) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Journey Started - Smart Transit</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #1a1a1a;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }
            
            .email-wrapper {
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            }
            
            .header {
                background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                padding: 40px 30px;
                text-align: center;
                color: white;
                position: relative;
            }
            
            .header::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
                opacity: 0.3;
            }
            
            .logo {
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 8px;
                position: relative;
                z-index: 1;
            }
            
            .header-title {
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 8px;
                position: relative;
                z-index: 1;
            }
            
            .header-subtitle {
                font-size: 16px;
                font-weight: 400;
                opacity: 0.9;
                position: relative;
                z-index: 1;
            }
            
            .content {
                padding: 40px 30px;
            }
            
            .status-badge {
                background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                color: white;
                padding: 12px 24px;
                border-radius: 50px;
                font-size: 14px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 24px;
                box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
            }
            
            .greeting {
                font-size: 18px;
                font-weight: 500;
                margin-bottom: 16px;
                color: #2c3e50;
            }
            
            .description {
                font-size: 16px;
                color: #666;
                margin-bottom: 32px;
                line-height: 1.6;
            }
            
            .journey-card {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 16px;
                padding: 28px;
                margin: 24px 0;
                color: white;
                position: relative;
                overflow: hidden;
            }
            
            .journey-card::before {
                content: '';
                position: absolute;
                top: -50%;
                right: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                animation: shimmer 3s ease-in-out infinite;
            }
            
            @keyframes shimmer {
                0%, 100% { transform: rotate(0deg); }
                50% { transform: rotate(180deg); }
            }
            
            .card-header {
                text-align: center;
                margin-bottom: 24px;
                position: relative;
                z-index: 1;
            }
            
            .card-title {
                font-size: 20px;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            .info-grid {
                display: grid;
                gap: 16px;
                position: relative;
                z-index: 1;
            }
            
            .info-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 0;
                border-bottom: 1px solid rgba(255,255,255,0.2);
            }
            
            .info-item:last-child {
                border-bottom: none;
            }
            
            .info-label {
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 8px;
                opacity: 0.9;
            }
            
            .info-value {
                font-weight: 600;
                text-align: right;
                word-break: break-word;
            }
            
            .balance-card {
                background: linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%);
                border: 1px solid #c8e6c9;
                border-radius: 16px;
                padding: 24px;
                margin: 24px 0;
                border-left: 6px solid #4CAF50;
            }
            
            .balance-header {
                color: #2e7d32;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .balance-amount {
                font-size: 28px;
                font-weight: 700;
                color: #2e7d32;
                margin-bottom: 8px;
            }
            
            .balance-tip {
                color: #666;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .reminder-card {
                background: linear-gradient(135deg, #fff8e1 0%, #fffde7 100%);
                border: 1px solid #ffcc02;
                border-radius: 16px;
                padding: 24px;
                margin: 24px 0;
                border-left: 6px solid #ff9800;
            }
            
            .reminder-header {
                color: #e65100;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .reminder-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .reminder-item {
                color: #bf360c;
                margin-bottom: 12px;
                padding-left: 24px;
                position: relative;
                line-height: 1.5;
            }
            
            .reminder-item::before {
                content: '✓';
                position: absolute;
                left: 0;
                color: #ff9800;
                font-weight: bold;
            }
            
            .footer {
                background: #f8f9fa;
                padding: 32px 30px;
                text-align: center;
                border-top: 1px solid #e9ecef;
            }
            
            .footer-brand {
                font-size: 18px;
                font-weight: 700;
                color: #2c3e50;
                margin-bottom: 8px;
            }
            
            .footer-tagline {
                font-size: 16px;
                color: #6c757d;
                margin-bottom: 16px;
            }
            
            .footer-note {
                font-size: 12px;
                color: #adb5bd;
                line-height: 1.4;
            }
            
            @media only screen and (max-width: 600px) {
                body {
                    padding: 10px;
                }
                
                .content {
                    padding: 24px 20px;
                }
                
                .header {
                    padding: 24px 20px;
                }
                
                .footer {
                    padding: 24px 20px;
                }
                
                .info-item {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }
                
                .info-value {
                    text-align: left;
                }
                
                .balance-amount {
                    font-size: 24px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            <div class="header">
                <div class="logo">🚌 Smart Transit</div>
                <div class="header-title">Journey Started Successfully!</div>
                <div class="header-subtitle">Your trip is now in progress</div>
            </div>
            
            <div class="content">
                <div class="status-badge">
                    <span>✅</span>
                    <span>JOURNEY IN PROGRESS</span>
                </div>
                
                <div class="greeting">Hello ${user.name}! 👋</div>
                
                <div class="description">
                    Great news! Your journey has been successfully initiated. Below are all the important details for your current trip.
                </div>
                
                <div class="journey-card">
                    <div class="card-header">
                        <div class="card-title">
                            <span>🎯</span>
                            <span>Journey Details</span>
                        </div>
                    </div>
                    
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">
                                <span>📍</span>
                                <span>Starting Point</span>
                            </div>
                            <div class="info-value">${journeyData.pick_point}</div>
                        </div>
                        
                        <div class="info-item">
                            <div class="info-label">
                                <span>�</span>
                                <span>Started At</span>
                            </div>
                            <div class="info-value">${new Date(journeyData.created_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</div>
                        </div>
                        
                        <div class="info-item">
                            <div class="info-label">
                                <span>💳</span>
                                <span>Card ID</span>
                            </div>
                            <div class="info-value">${user.card_id}</div>
                        </div>
                        
                        <div class="info-item">
                            <div class="info-label">
                                <span>🌍</span>
                                <span>GPS Coordinates</span>
                            </div>
                            <div class="info-value">${journeyData.current_latitude || 'N/A'}, ${journeyData.current_longitude || 'N/A'}</div>
                        </div>
                    </div>
                </div>
                
                <div class="balance-card">
                    <div class="balance-header">
                        <span>💰</span>
                        <span>Current Account Balance</span>
                    </div>
                    <div class="balance-amount">৳${user.balance.toFixed(2)} BDT</div>
                    <div class="balance-tip">
                        <span>💡</span>
                        <span>Ensure sufficient balance for your destination fare</span>
                    </div>
                </div>
                
                <div class="reminder-card">
                    <div class="reminder-header">
                        <span>⚠️</span>
                        <span>Important Reminders</span>
                    </div>
                    <ul class="reminder-list">
                        <li class="reminder-item">Scan your RFID card again when reaching your destination</li>
                        <li class="reminder-item">Fare will be automatically calculated and deducted</li>
                        <li class="reminder-item">Keep your card accessible for the exit scan</li>
                        <li class="reminder-item">Contact support@smarttransit.com for any assistance</li>
                    </ul>
                </div>
            </div>
            
            <div class="footer">
                <div class="footer-brand">Smart Transit System</div>
                <div class="footer-tagline">🌐 Making public transport smarter and more efficient</div>
                <div class="footer-note">
                    This is an automated message. Please do not reply to this email.<br>
                    © 2024 Smart Transit. All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
  `
}

// HTML email template for journey completion
const getJourneyCompleteTemplate = (user, journeyData, fareDetails) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Journey Completed - Smart Transit</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #1a1a1a;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }
            
            .email-wrapper {
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 16px;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            }
            
            .header {
                background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
                padding: 40px 30px;
                text-align: center;
                color: white;
                position: relative;
            }
            
            .header::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
                opacity: 0.3;
            }
            
            .logo {
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 8px;
                position: relative;
                z-index: 1;
            }
            
            .header-title {
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 8px;
                position: relative;
                z-index: 1;
            }
            
            .header-subtitle {
                font-size: 16px;
                font-weight: 400;
                opacity: 0.9;
                position: relative;
                z-index: 1;
            }
            
            .content {
                padding: 40px 30px;
            }
            
            .status-badge {
                background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                color: white;
                padding: 12px 24px;
                border-radius: 50px;
                font-size: 14px;
                font-weight: 600;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 24px;
                box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
            }
            
            .greeting {
                font-size: 18px;
                font-weight: 500;
                margin-bottom: 16px;
                color: #2c3e50;
            }
            
            .description {
                font-size: 16px;
                color: #666;
                margin-bottom: 32px;
                line-height: 1.6;
            }
            
            .journey-summary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 16px;
                padding: 28px;
                margin: 24px 0;
                color: white;
                position: relative;
                overflow: hidden;
            }
            
            .journey-summary::before {
                content: '';
                position: absolute;
                top: -50%;
                right: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
                animation: shimmer 3s ease-in-out infinite;
            }
            
            @keyframes shimmer {
                0%, 100% { transform: rotate(0deg); }
                50% { transform: rotate(180deg); }
            }
            
            .card-header {
                text-align: center;
                margin-bottom: 24px;
                position: relative;
                z-index: 1;
            }
            
            .card-title {
                font-size: 20px;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            .route-display {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 16px;
                margin: 20px 0;
                position: relative;
                z-index: 1;
            }
            
            .route-point {
                background: rgba(255,255,255,0.2);
                padding: 12px;
                border-radius: 12px;
                font-weight: 600;
                text-align: center;
                flex: 1;
                backdrop-filter: blur(10px);
            }
            
            .route-arrow {
                font-size: 24px;
                animation: bounce 2s ease-in-out infinite;
            }
            
            @keyframes bounce {
                0%, 100% { transform: translateX(0); }
                50% { transform: translateX(5px); }
            }
            
            .info-grid {
                display: grid;
                gap: 16px;
                position: relative;
                z-index: 1;
            }
            
            .info-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 0;
                border-bottom: 1px solid rgba(255,255,255,0.2);
            }
            
            .info-item:last-child {
                border-bottom: none;
            }
            
            .info-label {
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 8px;
                opacity: 0.9;
            }
            
            .info-value {
                font-weight: 600;
                text-align: right;
                word-break: break-word;
            }
            
            .receipt-section {
                background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
                border: 2px dashed #dee2e6;
                border-radius: 16px;
                padding: 28px;
                margin: 32px 0;
                position: relative;
            }
            
            .receipt-header {
                text-align: center;
                margin-bottom: 24px;
                color: #2c3e50;
            }
            
            .receipt-title {
                font-size: 20px;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                margin-bottom: 8px;
            }
            
            .receipt-id {
                font-size: 12px;
                color: #6c757d;
                font-family: 'Courier New', monospace;
            }
            
            .fare-breakdown {
                background: linear-gradient(135deg, #e3f2fd 0%, #f1f8ff 100%);
                border: 1px solid #bbdefb;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
                border-left: 6px solid #2196F3;
            }
            
            .breakdown-header {
                color: #1565c0;
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .breakdown-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin: 12px 0;
                padding: 8px 0;
                color: #2c3e50;
            }
            
            .breakdown-total {
                border-top: 2px solid #2196F3;
                padding-top: 12px;
                margin-top: 16px;
                font-weight: 700;
                font-size: 18px;
                color: #1565c0;
            }
            
            .total-charge {
                background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                color: white;
                padding: 20px;
                border-radius: 12px;
                text-align: center;
                margin: 20px 0;
                box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
            }
            
            .charge-amount {
                font-size: 24px;
                font-weight: 700;
                margin: 8px 0;
            }
            
            .balance-card {
                background: linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%);
                border: 1px solid #c8e6c9;
                border-radius: 16px;
                padding: 24px;
                margin: 24px 0;
                border-left: 6px solid #4CAF50;
            }
            
            .balance-header {
                color: #2e7d32;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .balance-amount {
                font-size: 28px;
                font-weight: 700;
                color: #2e7d32;
                margin-bottom: 8px;
            }
            
            .balance-status {
                font-size: 14px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .rating-card {
                background: linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%);
                border: 1px solid #c8e6c9;
                border-radius: 16px;
                padding: 24px;
                margin: 24px 0;
                text-align: center;
            }
            
            .rating-header {
                color: #2e7d32;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            
            .rating-stars {
                font-size: 32px;
                margin: 16px 0;
                letter-spacing: 4px;
            }
            
            .quick-actions {
                background: linear-gradient(135deg, #fff8e1 0%, #fffde7 100%);
                border: 1px solid #ffcc02;
                border-radius: 16px;
                padding: 24px;
                margin: 24px 0;
                border-left: 6px solid #ff9800;
            }
            
            .actions-header {
                color: #e65100;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .actions-list {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .action-item {
                color: #bf360c;
                margin-bottom: 12px;
                padding-left: 24px;
                position: relative;
                line-height: 1.5;
            }
            
            .action-item::before {
                content: '→';
                position: absolute;
                left: 0;
                color: #ff9800;
                font-weight: bold;
            }
            
            .footer {
                background: #f8f9fa;
                padding: 32px 30px;
                text-align: center;
                border-top: 1px solid #e9ecef;
            }
            
            .footer-brand {
                font-size: 18px;
                font-weight: 700;
                color: #2c3e50;
                margin-bottom: 8px;
            }
            
            .footer-tagline {
                font-size: 16px;
                color: #6c757d;
                margin-bottom: 8px;
            }
            
            .footer-thanks {
                font-size: 16px;
                color: #2c3e50;
                font-weight: 500;
                margin-bottom: 16px;
            }
            
            .footer-note {
                font-size: 12px;
                color: #adb5bd;
                line-height: 1.4;
            }
            
            @media only screen and (max-width: 600px) {
                body {
                    padding: 10px;
                }
                
                .content {
                    padding: 24px 20px;
                }
                
                .header {
                    padding: 24px 20px;
                }
                
                .footer {
                    padding: 24px 20px;
                }
                
                .receipt-section {
                    padding: 20px;
                }
                
                .route-display {
                    flex-direction: column;
                    gap: 8px;
                }
                
                .route-arrow {
                    transform: rotate(90deg);
                }
                
                .info-item {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }
                
                .info-value {
                    text-align: left;
                }
                
                .breakdown-item {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 4px;
                }
                
                .balance-amount {
                    font-size: 24px;
                }
                
                .charge-amount {
                    font-size: 20px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            <div class="header">
                <div class="logo">🚌 Smart Transit</div>
                <div class="header-title">Journey Completed Successfully!</div>
                <div class="header-subtitle">Thank you for traveling with us</div>
            </div>
            
            <div class="content">
                <div class="status-badge">
                    <span>🎉</span>
                    <span>JOURNEY COMPLETED</span>
                </div>
                
                <div class="greeting">Hello ${user.name}! 👋</div>
                
                <div class="description">
                    Fantastic! Your journey has been completed successfully. Here's your detailed receipt and journey summary.
                </div>
                
                <div class="journey-summary">
                    <div class="card-header">
                        <div class="card-title">
                            <span>🛣️</span>
                            <span>Journey Summary</span>
                        </div>
                    </div>
                    
                    <div class="route-display">
                        <div class="route-point">
                            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">FROM</div>
                            <div>${journeyData.pick_point}</div>
                        </div>
                        <div class="route-arrow">→</div>
                        <div class="route-point">
                            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 4px;">TO</div>
                            <div>${journeyData.drop_point}</div>
                        </div>
                    </div>
                    
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">
                                <span>🕐</span>
                                <span>Completed At : </span>
                            </div>
                            <div class="info-value">${new Date(journeyData.travel_time).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</div>
                        </div>
                        
                        <div class="info-item">
                            <div class="info-label">
                                <span>💳</span>
                                <span>Card ID : </span>
                            </div>
                            <div class="info-value">${user.card_id}</div>
                        </div>
                    </div>
                </div>
                
                <div class="receipt-section">
                    <div class="receipt-header">
                        <div class="receipt-title">
                            <span>🧾</span>
                            <span>Digital Receipt</span>
                        </div>
                        <div class="receipt-id">Receipt ID: ST-${Date.now()}-${user.user_id}</div>
                    </div>
                    
                    <div class="fare-breakdown">
                        <div class="breakdown-header">
                            <span>💰</span>
                            <span>Fare Breakdown</span>
                        </div>
                        
                        <div class="breakdown-item">
                            <span>Distance Traveled</span>
                            <span>${(fareDetails.total_cost / 20).toFixed(2)} km</span>
                        </div>
                        
                        <div class="breakdown-item">
                            <span>Rate (per kilometer)</span>
                            <span>৳20.00/km</span>
                        </div>
                        
                        <div class="breakdown-item breakdown-total">
                            <span>Total Fare</span>
                            <span>৳${fareDetails.total_cost.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div class="total-charge">
                        <div style="font-size: 16px; opacity: 0.9;">Amount Deducted</div>
                        <div class="charge-amount">৳${fareDetails.total_cost.toFixed(2)} BDT</div>
                        <div style="font-size: 14px; opacity: 0.8;">✅ Payment processed successfully</div>
                    </div>
                    
                    <div class="balance-card">
                        <div class="balance-header">
                            <span>💰</span>
                            <span>Updated Account Balance</span>
                        </div>
                        <div class="balance-amount">৳${fareDetails.remaining_balance.toFixed(2)} BDT</div>
                        <div class="balance-status">
                            ${fareDetails.remaining_balance < 100 ? 
                                '<span style="color: #f57c00;">⚠️ Low balance! Consider recharging soon.</span>' : 
                                '<span style="color: #2e7d32;">✅ Sufficient balance for future journeys.</span>'
                            }
                        </div>
                    </div>
                </div>
                
                <div class="rating-card">
                    <div class="rating-header">
                        <span>⭐</span>
                        <span>Rate Your Journey</span>
                    </div>
                    <div style="color: #666; margin-bottom: 12px;">How was your experience today?</div>
                    <div class="rating-stars">⭐⭐⭐⭐⭐</div>
                    <div style="color: #666; font-size: 14px;">Your feedback helps us improve our services</div>
                </div>
                
                <div class="quick-actions">
                    <div class="actions-header">
                        <span>🚀</span>
                        <span>Quick Actions</span>
                    </div>
                    <ul class="actions-list">
                        <li class="action-item">Recharge your account for future journeys</li>
                        <li class="action-item">View complete journey history in your dashboard</li>
                        <li class="action-item">Download this receipt for your records</li>
                        <li class="action-item">Contact support@smarttransit.com for assistance</li>
                    </ul>
                </div>
            </div>
            
            <div class="footer">
                <div class="footer-brand">Smart Transit System</div>
                <div class="footer-tagline">🌐 Making public transport smarter and more efficient</div>
                <div class="footer-thanks">🚌 Thank you for choosing Smart Transit!</div>
                <div class="footer-note">
                    This is an automated message. Please do not reply to this email.<br>
                    © 2024 Smart Transit. All rights reserved.
                </div>
            </div>
        </div>
    </body>
    </html>
  `
}

// Send journey start email
export const sendJourneyStartEmail = async (user, journeyData) => {
  try {
    const transporter = createTransporter()
    
    const mailOptions = {
      from: `"Smart Transit System" <${process.env.Email_username}>`,
      to: user.email,
      subject: `🚌 Journey Started - Smart Transit`,
      html: getJourneyStartTemplate(user, journeyData)
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('Journey start email sent successfully:', info.messageId)
    return { success: true, messageId: info.messageId }
    
  } catch (error) {
    console.error('Error sending journey start email:', error)
    return { success: false, error: error.message }
  }
}

// Send journey completion email
export const sendJourneyCompleteEmail = async (user, journeyData, fareDetails) => {
  try {
    const transporter = createTransporter()
    
    const mailOptions = {
      from: `"Smart Transit System" <${process.env.Email_username}>`,
      to: user.email,
      subject: `🏁 Journey Completed - Receipt & Summary`,
      html: getJourneyCompleteTemplate(user, journeyData, fareDetails)
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('Journey completion email sent successfully:', info.messageId)
    return { success: true, messageId: info.messageId }
    
  } catch (error) {
    console.error('Error sending journey completion email:', error)
    return { success: false, error: error.message }
  }
}

// Send low balance alert email
export const sendLowBalanceAlert = async (user, currentBalance) => {
  try {
    const transporter = createTransporter()
    
    const lowBalanceTemplate = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Low Balance Alert - Smart Transit</title>
          <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
              
              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
              }
              
              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                  line-height: 1.6;
                  color: #1a1a1a;
                  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
                  min-height: 100vh;
                  padding: 20px;
              }
              
              .email-wrapper {
                  max-width: 600px;
                  margin: 0 auto;
                  background: #ffffff;
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
              }
              
              .header {
                  background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
                  padding: 40px 30px;
                  text-align: center;
                  color: white;
                  position: relative;
              }
              
              .header::before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
                  opacity: 0.3;
              }
              
              .warning-icon {
                  font-size: 48px;
                  margin-bottom: 16px;
                  position: relative;
                  z-index: 1;
                  animation: pulse 2s ease-in-out infinite;
              }
              
              @keyframes pulse {
                  0%, 100% { transform: scale(1); }
                  50% { transform: scale(1.1); }
              }
              
              .header-title {
                  font-size: 24px;
                  font-weight: 600;
                  margin-bottom: 8px;
                  position: relative;
                  z-index: 1;
              }
              
              .header-subtitle {
                  font-size: 16px;
                  font-weight: 400;
                  opacity: 0.9;
                  position: relative;
                  z-index: 1;
              }
              
              .content {
                  padding: 40px 30px;
              }
              
              .alert-badge {
                  background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
                  color: white;
                  padding: 12px 24px;
                  border-radius: 50px;
                  font-size: 14px;
                  font-weight: 600;
                  display: inline-flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 24px;
                  box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
              }
              
              .greeting {
                  font-size: 18px;
                  font-weight: 500;
                  margin-bottom: 16px;
                  color: #2c3e50;
              }
              
              .alert-message {
                  background: linear-gradient(135deg, #fff3e0 0%, #ffecb3 100%);
                  border: 1px solid #ffcc02;
                  border-radius: 16px;
                  padding: 28px;
                  margin: 24px 0;
                  border-left: 6px solid #ff9800;
                  text-align: center;
              }
              
              .alert-title {
                  color: #e65100;
                  font-size: 20px;
                  font-weight: 600;
                  margin-bottom: 16px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 8px;
              }
              
              .balance-display {
                  background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
                  color: white;
                  padding: 24px;
                  border-radius: 16px;
                  margin: 20px 0;
                  text-align: center;
                  box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
              }
              
              .balance-label {
                  font-size: 14px;
                  opacity: 0.9;
                  margin-bottom: 8px;
              }
              
              .balance-amount {
                  font-size: 32px;
                  font-weight: 700;
                  margin-bottom: 8px;
              }
              
              .balance-status {
                  font-size: 14px;
                  opacity: 0.8;
              }
              
              .warning-text {
                  color: #bf360c;
                  font-size: 16px;
                  line-height: 1.6;
                  margin: 16px 0;
              }
              
              .action-section {
                  background: linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%);
                  border: 1px solid #c8e6c9;
                  border-radius: 16px;
                  padding: 24px;
                  margin: 24px 0;
                  border-left: 6px solid #4CAF50;
              }
              
              .action-header {
                  color: #2e7d32;
                  font-size: 18px;
                  font-weight: 600;
                  margin-bottom: 16px;
                  display: flex;
                  align-items: center;
                  gap: 8px;
              }
              
              .action-list {
                  list-style: none;
                  padding: 0;
                  margin: 0;
              }
              
              .action-item {
                  color: #2e7d32;
                  margin-bottom: 12px;
                  padding-left: 24px;
                  position: relative;
                  line-height: 1.5;
              }
              
              .action-item::before {
                  content: '💳';
                  position: absolute;
                  left: 0;
              }
              
              .recharge-button {
                  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                  color: white;
                  padding: 16px 32px;
                  border-radius: 50px;
                  font-size: 16px;
                  font-weight: 600;
                  text-decoration: none;
                  display: inline-block;
                  margin: 20px 0;
                  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
                  text-align: center;
                  width: 100%;
                  box-sizing: border-box;
              }
              
              .footer {
                  background: #f8f9fa;
                  padding: 32px 30px;
                  text-align: center;
                  border-top: 1px solid #e9ecef;
              }
              
              .footer-brand {
                  font-size: 18px;
                  font-weight: 700;
                  color: #2c3e50;
                  margin-bottom: 8px;
              }
              
              .footer-tagline {
                  font-size: 16px;
                  color: #6c757d;
                  margin-bottom: 16px;
              }
              
              .footer-note {
                  font-size: 12px;
                  color: #adb5bd;
                  line-height: 1.4;
              }
              
              @media only screen and (max-width: 600px) {
                  body {
                      padding: 10px;
                  }
                  
                  .content {
                      padding: 24px 20px;
                  }
                  
                  .header {
                      padding: 24px 20px;
                  }
                  
                  .footer {
                      padding: 24px 20px;
                  }
                  
                  .alert-message {
                      padding: 20px;
                  }
                  
                  .balance-amount {
                      font-size: 28px;
                  }
                  
                  .warning-icon {
                      font-size: 40px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-wrapper">
              <div class="header">
                  <div class="warning-icon">⚠️</div>
                  <div class="header-title">Low Balance Alert</div>
                  <div class="header-subtitle">Immediate attention required</div>
              </div>
              
              <div class="content">
                  <div class="alert-badge">
                      <span>🚨</span>
                      <span>LOW BALANCE WARNING</span>
                  </div>
                  
                  <div class="greeting">Hello ${user.name}! 👋</div>
                  
                  <div class="alert-message">
                      <div class="alert-title">
                          <span>💰</span>
                          <span>Your Account Balance is Running Low!</span>
                      </div>
                      
                      <div class="balance-display">
                          <div class="balance-label">Current Balance</div>
                          <div class="balance-amount">৳${currentBalance.toFixed(2)} BDT</div>
                          <div class="balance-status">⚠️ Below recommended minimum</div>
                      </div>
                      
                      <div class="warning-text">
                          To avoid any inconvenience during your next journey, we strongly recommend recharging your account immediately. Low balance may prevent you from completing your trips successfully.
                      </div>
                  </div>
                  
                  <div class="action-section">
                      <div class="action-header">
                          <span>🚀</span>
                          <span>Quick Recharge Options</span>
                      </div>
                      <ul class="action-list">
                          <li class="action-item">Visit our website at smarttransit.com</li>
                          <li class="action-item">Use our mobile app for instant recharge</li>
                          <li class="action-item">Visit any authorized recharge station</li>
                          <li class="action-item">Call our helpline: +880-1234-567890</li>
                      </ul>
                      
                      <a href="#" class="recharge-button">
                          💳 Recharge Now
                      </a>
                  </div>
              </div>
              
              <div class="footer">
                  <div class="footer-brand">Smart Transit System</div>
                  <div class="footer-tagline">🌐 Keeping you connected and moving</div>
                  <div class="footer-note">
                      This is an automated alert. Please do not reply to this email.<br>
                      © 2024 Smart Transit. All rights reserved.
                  </div>
              </div>
          </div>
      </body>
      </html>
    `
    
    const mailOptions = {
      from: `"Smart Transit System" <${process.env.Email_username}>`,
      to: user.email,
      subject: `⚠️ Urgent: Low Balance Alert - Smart Transit`,
      html: lowBalanceTemplate
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('Low balance alert email sent successfully:', info.messageId)
    return { success: true, messageId: info.messageId }
    
  } catch (error) {
    console.error('Error sending low balance alert email:', error)
    return { success: false, error: error.message }
  }
}

// Send recharge confirmation email
export const sendRechargeConfirmationEmail = async (user, rechargeData) => {
  try {
    const transporter = createTransporter()
    
    const rechargeTemplate = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recharge Successful - Smart Transit</title>
          <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
              
              * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
              }
              
              body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                  line-height: 1.6;
                  color: #1a1a1a;
                  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                  min-height: 100vh;
                  padding: 20px;
              }
              
              .email-wrapper {
                  max-width: 600px;
                  margin: 0 auto;
                  background: #ffffff;
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
              }
              
              .header {
                  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                  padding: 40px 30px;
                  text-align: center;
                  color: white;
                  position: relative;
              }
              
              .header::before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
                  opacity: 0.3;
              }
              
              .success-icon {
                  font-size: 48px;
                  margin-bottom: 16px;
                  position: relative;
                  z-index: 1;
                  animation: checkmark 1s ease-in-out;
              }
              
              @keyframes checkmark {
                  0% { transform: scale(0) rotate(0deg); }
                  50% { transform: scale(1.2) rotate(180deg); }
                  100% { transform: scale(1) rotate(360deg); }
              }
              
              .header-title {
                  font-size: 24px;
                  font-weight: 600;
                  margin-bottom: 8px;
                  position: relative;
                  z-index: 1;
              }
              
              .header-subtitle {
                  font-size: 16px;
                  font-weight: 400;
                  opacity: 0.9;
                  position: relative;
                  z-index: 1;
              }
              
              .content {
                  padding: 40px 30px;
              }
              
              .success-badge {
                  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                  color: white;
                  padding: 12px 24px;
                  border-radius: 50px;
                  font-size: 14px;
                  font-weight: 600;
                  display: inline-flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 24px;
                  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
              }
              
              .greeting {
                  font-size: 18px;
                  font-weight: 500;
                  margin-bottom: 16px;
                  color: #2c3e50;
              }
              
              .description {
                  font-size: 16px;
                  color: #666;
                  margin-bottom: 32px;
                  line-height: 1.6;
              }
              
              .recharge-summary {
                  background: linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%);
                  border: 1px solid #c8e6c9;
                  border-radius: 16px;
                  padding: 28px;
                  margin: 24px 0;
                  border-left: 6px solid #4CAF50;
              }
              
              .summary-header {
                  color: #2e7d32;
                  font-size: 20px;
                  font-weight: 600;
                  margin-bottom: 20px;
                  display: flex;
                  align-items: center;
                  gap: 8px;
              }
              
              .amount-display {
                  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                  color: white;
                  padding: 24px;
                  border-radius: 16px;
                  text-align: center;
                  margin: 20px 0;
                  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
              }
              
              .amount-label {
                  font-size: 14px;
                  opacity: 0.9;
                  margin-bottom: 8px;
              }
              
              .amount-value {
                  font-size: 32px;
                  font-weight: 700;
                  margin-bottom: 8px;
              }
              
              .amount-status {
                  font-size: 14px;
                  opacity: 0.8;
              }
              
              .transaction-details {
                  background: #f8f9fa;
                  border: 1px solid #dee2e6;
                  border-radius: 12px;
                  padding: 20px;
                  margin: 20px 0;
              }
              
              .detail-row {
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 12px 0;
                  border-bottom: 1px solid #e9ecef;
                  color: #2c3e50;
              }
              
              .detail-row:last-child {
                  border-bottom: none;
              }
              
              .detail-label {
                  font-weight: 500;
                  display: flex;
                  align-items: center;
                  gap: 8px;
              }
              
              .detail-value {
                  font-weight: 600;
                  text-align: right;
              }
              
              .new-balance-card {
                  background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
                  color: white;
                  padding: 28px;
                  border-radius: 16px;
                  text-align: center;
                  margin: 24px 0;
                  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
              }
              
              .balance-header {
                  font-size: 18px;
                  font-weight: 600;
                  margin-bottom: 16px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 8px;
              }
              
              .balance-amount {
                  font-size: 36px;
                  font-weight: 700;
                  margin-bottom: 8px;
              }
              
              .balance-message {
                  font-size: 14px;
                  opacity: 0.9;
              }
              
              .benefits-section {
                  background: linear-gradient(135deg, #fff8e1 0%, #fffde7 100%);
                  border: 1px solid #ffcc02;
                  border-radius: 16px;
                  padding: 24px;
                  margin: 24px 0;
                  border-left: 6px solid #ff9800;
              }
              
              .benefits-header {
                  color: #e65100;
                  font-size: 18px;
                  font-weight: 600;
                  margin-bottom: 16px;
                  display: flex;
                  align-items: center;
                  gap: 8px;
              }
              
              .benefits-list {
                  list-style: none;
                  padding: 0;
                  margin: 0;
              }
              
              .benefit-item {
                  color: #bf360c;
                  margin-bottom: 12px;
                  padding-left: 24px;
                  position: relative;
                  line-height: 1.5;
              }
              
              .benefit-item::before {
                  content: '🎯';
                  position: absolute;
                  left: 0;
              }
              
              .footer {
                  background: #f8f9fa;
                  padding: 32px 30px;
                  text-align: center;
                  border-top: 1px solid #e9ecef;
              }
              
              .footer-brand {
                  font-size: 18px;
                  font-weight: 700;
                  color: #2c3e50;
                  margin-bottom: 8px;
              }
              
              .footer-tagline {
                  font-size: 16px;
                  color: #6c757d;
                  margin-bottom: 8px;
              }
              
              .footer-thanks {
                  font-size: 16px;
                  color: #2c3e50;
                  font-weight: 500;
                  margin-bottom: 16px;
              }
              
              .footer-note {
                  font-size: 12px;
                  color: #adb5bd;
                  line-height: 1.4;
              }
              
              @media only screen and (max-width: 600px) {
                  body {
                      padding: 10px;
                  }
                  
                  .content {
                      padding: 24px 20px;
                  }
                  
                  .header {
                      padding: 24px 20px;
                  }
                  
                  .footer {
                      padding: 24px 20px;
                  }
                  
                  .detail-row {
                      flex-direction: column;
                      align-items: flex-start;
                      gap: 8px;
                  }
                  
                  .detail-value {
                      text-align: left;
                  }
                  
                  .amount-value {
                      font-size: 28px;
                  }
                  
                  .balance-amount {
                      font-size: 30px;
                  }
              }
          </style>
      </head>
      <body>
          <div class="email-wrapper">
              <div class="header">
                  <div class="success-icon">✅</div>
                  <div class="header-title">Recharge Successful!</div>
                  <div class="header-subtitle">Your account has been topped up</div>
              </div>
              
              <div class="content">
                  <div class="success-badge">
                      <span>🎉</span>
                      <span>PAYMENT PROCESSED</span>
                  </div>
                  
                  <div class="greeting">Hello ${user.name}! 👋</div>
                  
                  <div class="description">
                      Fantastic news! Your account recharge has been processed successfully. Your Smart Transit card is now ready for seamless journeys.
                  </div>
                  
                  <div class="recharge-summary">
                      <div class="summary-header">
                          <span>💳</span>
                          <span>Recharge Summary</span>
                      </div>
                      
                      <div class="amount-display">
                          <div class="amount-label">Amount Added</div>
                          <div class="amount-value">৳${rechargeData.amount.toFixed(2)} BDT</div>
                          <div class="amount-status">✅ Successfully credited to your account</div>
                      </div>
                      
                      <div class="transaction-details">
                          <div class="detail-row">
                              <div class="detail-label">
                                  <span>🏦</span>
                                  <span>Payment Method</span>
                              </div>
                              <div class="detail-value">Stripe Payment Gateway</div>
                          </div>
                          
                          <div class="detail-row">
                              <div class="detail-label">
                                  <span>🔗</span>
                                  <span>Transaction ID</span>
                              </div>
                              <div class="detail-value">${rechargeData.transactionId || 'ST-' + Date.now()}</div>
                          </div>
                          
                          <div class="detail-row">
                              <div class="detail-label">
                                  <span>📅</span>
                                  <span>Date & Time</span>
                              </div>
                              <div class="detail-value">${new Date().toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                              })}</div>
                          </div>
                          
                          <div class="detail-row">
                              <div class="detail-label">
                                  <span>💳</span>
                                  <span>Card ID</span>
                              </div>
                              <div class="detail-value">${user.card_id}</div>
                          </div>
                      </div>
                  </div>
                  
                  <div class="new-balance-card">
                      <div class="balance-header">
                          <span>💰</span>
                          <span>Updated Account Balance</span>
                      </div>
                      <div class="balance-amount">৳${rechargeData.newBalance.toFixed(2)} BDT</div>
                      <div class="balance-message">🚀 Ready for your next journey!</div>
                  </div>
                  
                  <div class="benefits-section">
                      <div class="benefits-header">
                          <span>🌟</span>
                          <span>What's Next?</span>
                      </div>
                      <ul class="benefits-list">
                          <li class="benefit-item">Start your journeys with confidence - sufficient balance available</li>
                          <li class="benefit-item">Enjoy seamless travel across all Smart Transit routes</li>
                          <li class="benefit-item">Track your balance and usage in real-time on our dashboard</li>
                          <li class="benefit-item">Set up auto-recharge to never run out of balance again</li>
                      </ul>
                  </div>
              </div>
              
              <div class="footer">
                  <div class="footer-brand">Smart Transit System</div>
                  <div class="footer-tagline">🌐 Making public transport smarter and more efficient</div>
                  <div class="footer-thanks">🚀 Thank you for choosing Smart Transit!</div>
                  <div class="footer-note">
                      This is an automated confirmation. Please keep this email for your records.<br>
                      © 2024 Smart Transit. All rights reserved.
                  </div>
              </div>
          </div>
      </body>
      </html>
    `
    
    const mailOptions = {
      from: `"Smart Transit System" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `🎉 Recharge Successful - ৳${rechargeData.amount} Added`,
      html: rechargeTemplate
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('Recharge confirmation email sent successfully:', info.messageId)
    return { success: true, messageId: info.messageId }
    
  } catch (error) {
    console.error('Error sending recharge confirmation email:', error)
    return { success: false, error: error.message }
  }
}

// Simple notification email function for card blocking/unblocking
export const sendNotificationEmail = async (email, subject, message) => {
  try {
    const transporter = createTransporter()
    
    const notificationTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
          <style>
              body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                  margin: 0; 
                  padding: 20px; 
                  background-color: #f8fafc; 
              }
              .container { 
                  max-width: 600px; 
                  margin: 0 auto; 
                  background: white; 
                  border-radius: 12px; 
                  box-shadow: 0 4px 12px rgba(0,0,0,0.1); 
                  overflow: hidden; 
              }
              .header { 
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                  color: white; 
                  padding: 30px; 
                  text-align: center; 
              }
              .content { 
                  padding: 30px; 
                  line-height: 1.6; 
                  color: #333; 
              }
              .footer { 
                  background: #f8fafc; 
                  padding: 20px; 
                  text-align: center; 
                  font-size: 12px; 
                  color: #666; 
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1 style="margin: 0; font-size: 24px;">🚌 Smart Transit</h1>
                  <p style="margin: 10px 0 0 0; opacity: 0.9;">${subject}</p>
              </div>
              <div class="content">
                  ${message.split('\n').map(line => `<p style="margin: 0 0 15px 0;">${line}</p>`).join('')}
              </div>
              <div class="footer">
                  This is an automated notification from Smart Transit System.<br>
                  © 2024 Smart Transit. All rights reserved.
              </div>
          </div>
      </body>
      </html>
    `
    
    const mailOptions = {
      from: `"Smart Transit System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: notificationTemplate
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('Notification email sent successfully:', info.messageId)
    return { success: true, messageId: info.messageId }
    
  } catch (error) {
    console.error('Error sending notification email:', error)
    return { success: false, error: error.message }
  }
}

export default {
  sendJourneyStartEmail,
  sendJourneyCompleteEmail,
  sendLowBalanceAlert,
  sendRechargeConfirmationEmail,
  sendNotificationEmail
}
