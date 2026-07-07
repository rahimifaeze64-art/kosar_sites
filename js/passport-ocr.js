// Passport OCR Module - استخراج اطلاعات از پاسپورت
const PassportOCR = {
    // Initialize Tesseract.js
    async init() {
        try {
            debugLogger('Initializing Tesseract OCR...', 'info');
            
            // Check if Tesseract is loaded
            if (typeof Tesseract === 'undefined') {
                debugLogger('Tesseract not loaded, will load from CDN', 'warning');
                await this.loadTesseract();
            }
            
            debugLogger('Tesseract OCR initialized', 'success');
            return true;
        } catch (error) {
            debugLogger('Error initializing OCR', 'error', error);
            return false;
        }
    },
    
    // Load Tesseract from CDN
    async loadTesseract() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },
    
    // Extract text from passport image
    async extractPassportInfo(imageFile) {
        try {
            debugLogger('Starting passport OCR extraction...', 'info');
            
            // Show loading indicator
            UTILS.showNotification('در حال استخراج اطلاعات از پاسپورت...', 'info', 10000);
            
            // Initialize if needed
            await this.init();
            
            // Create image URL
            const imageUrl = URL.createObjectURL(imageFile);
            
            // Perform OCR
            const result = await Tesseract.recognize(
                imageUrl,
                'eng', // English for passport MRZ
                {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            debugLogger(`OCR Progress: ${Math.round(m.progress * 100)}%`, 'info');
                        }
                    }
                }
            );
            
            // Clean up
            URL.revokeObjectURL(imageUrl);
            
            debugLogger('OCR completed', 'success', result);
            
            // Parse the extracted text
            const passportInfo = this.parsePassportText(result.data.text);
            
            UTILS.showNotification('اطلاعات پاسپورت استخراج شد', 'success');
            
            return passportInfo;
            
        } catch (error) {
            debugLogger('Error extracting passport info', 'error', error);
            UTILS.showNotification('خطا در استخراج اطلاعات پاسپورت', 'error');
            return null;
        }
    },
    
    // Parse passport MRZ (Machine Readable Zone)
    parsePassportText(text) {
        try {
            debugLogger('Parsing passport text...', 'info', text);
            
            const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            const passportInfo = {
                fullText: text,
                documentType: '',
                countryCode: '',
                surname: '',
                givenNames: '',
                passportNumber: '',
                nationality: '',
                dateOfBirth: '',
                sex: '',
                expiryDate: '',
                personalNumber: '',
                mrzLine1: '',
                mrzLine2: ''
            };
            
            // Find MRZ lines (usually at the bottom, starting with P<)
            const mrzLines = lines.filter(line => 
                line.startsWith('P<') || 
                line.match(/^[A-Z0-9<]{44}$/) ||
                line.match(/^[A-Z]{1,2}[A-Z0-9<]{42,44}$/)
            );
            
            if (mrzLines.length >= 2) {
                passportInfo.mrzLine1 = mrzLines[0];
                passportInfo.mrzLine2 = mrzLines[1];
                
                // Parse MRZ Line 1: P<COUNTRY_CODE<SURNAME<<GIVEN_NAMES
                const line1 = mrzLines[0];
                if (line1.startsWith('P<')) {
                    passportInfo.documentType = 'P';
                    passportInfo.countryCode = line1.substring(2, 5).replace(/<+$/, '');
                    
                    const names = line1.substring(5).split('<<');
                    if (names.length >= 1) {
                        passportInfo.surname = names[0].replace(/<+/g, ' ').trim();
                    }
                    if (names.length >= 2) {
                        passportInfo.givenNames = names[1].replace(/<+/g, ' ').trim();
                    }
                }
                
                // Parse MRZ Line 2: PASSPORT_NO<CHECK<NATIONALITY<DOB<CHECK<SEX<EXPIRY<CHECK<PERSONAL_NO<CHECK
                const line2 = mrzLines[1];
                if (line2.length >= 44) {
                    passportInfo.passportNumber = line2.substring(0, 9).replace(/<+/g, '');
                    passportInfo.nationality = line2.substring(10, 13).replace(/<+/g, '');
                    
                    // Date of birth (YYMMDD)
                    const dob = line2.substring(13, 19);
                    if (dob.match(/^\d{6}$/)) {
                        const year = parseInt(dob.substring(0, 2));
                        const fullYear = year > 50 ? 1900 + year : 2000 + year;
                        passportInfo.dateOfBirth = `${fullYear}-${dob.substring(2, 4)}-${dob.substring(4, 6)}`;
                    }
                    
                    // Sex
                    passportInfo.sex = line2.substring(20, 21);
                    
                    // Expiry date (YYMMDD)
                    const expiry = line2.substring(21, 27);
                    if (expiry.match(/^\d{6}$/)) {
                        const year = parseInt(expiry.substring(0, 2));
                        const fullYear = year > 50 ? 1900 + year : 2000 + year;
                        passportInfo.expiryDate = `${fullYear}-${expiry.substring(2, 4)}-${expiry.substring(4, 6)}`;
                    }
                    
                    // Personal number
                    passportInfo.personalNumber = line2.substring(28, 42).replace(/<+/g, '');
                }
            }
            
            // Try to extract other information from non-MRZ text
            for (const line of lines) {
                // Look for passport number patterns
                if (!passportInfo.passportNumber && line.match(/[A-Z]{1,2}\d{6,9}/)) {
                    const match = line.match(/([A-Z]{1,2}\d{6,9})/);
                    if (match) passportInfo.passportNumber = match[1];
                }
                
                // Look for dates (DD/MM/YYYY or DD-MM-YYYY)
                const dateMatches = line.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g);
                if (dateMatches && dateMatches.length > 0) {
                    if (!passportInfo.dateOfBirth) {
                        passportInfo.dateOfBirth = dateMatches[0].replace(/\//g, '-');
                    }
                }
            }
            
            debugLogger('Passport info parsed', 'success', passportInfo);
            
            return passportInfo;
            
        } catch (error) {
            debugLogger('Error parsing passport text', 'error', error);
            return {
                fullText: text,
                error: 'خطا در تجزیه اطلاعات'
            };
        }
    },
    
    // Format passport info for display
    formatPassportInfo(passportInfo) {
        if (!passportInfo) return 'اطلاعاتی استخراج نشد';
        
        let formatted = '';
        
        if (passportInfo.surname || passportInfo.givenNames) {
            formatted += `نام: ${passportInfo.givenNames} ${passportInfo.surname}\n`;
        }
        
        if (passportInfo.passportNumber) {
            formatted += `شماره پاسپورت: ${passportInfo.passportNumber}\n`;
        }
        
        if (passportInfo.nationality) {
            formatted += `ملیت: ${passportInfo.nationality}\n`;
        }
        
        if (passportInfo.dateOfBirth) {
            formatted += `تاریخ تولد: ${passportInfo.dateOfBirth}\n`;
        }
        
        if (passportInfo.sex) {
            const sexText = passportInfo.sex === 'M' ? 'مرد' : passportInfo.sex === 'F' ? 'زن' : passportInfo.sex;
            formatted += `جنسیت: ${sexText}\n`;
        }
        
        if (passportInfo.expiryDate) {
            formatted += `تاریخ انقضا: ${passportInfo.expiryDate}\n`;
        }
        
        if (passportInfo.mrzLine1) {
            formatted += `\nMRZ Line 1: ${passportInfo.mrzLine1}\n`;
        }
        
        if (passportInfo.mrzLine2) {
            formatted += `MRZ Line 2: ${passportInfo.mrzLine2}\n`;
        }
        
        if (!formatted) {
            formatted = 'اطلاعات استخراج شده:\n\n' + passportInfo.fullText;
        }
        
        return formatted.trim();
    },
    
    // Auto-fill form fields from passport info
    autoFillForm(passportInfo, formData) {
        if (!passportInfo) return formData;
        
        try {
            // Fill name
            if (passportInfo.givenNames && passportInfo.surname) {
                formData.studentName = `${passportInfo.givenNames} ${passportInfo.surname}`;
            }
            
            // Fill passport number
            if (passportInfo.passportNumber) {
                formData.passportNumber = passportInfo.passportNumber;
            }
            
            // Fill date of birth
            if (passportInfo.dateOfBirth) {
                formData.birthDate = passportInfo.dateOfBirth;
            }
            
            // Fill gender
            if (passportInfo.sex) {
                formData.gender = passportInfo.sex === 'M' ? 'مرد' : passportInfo.sex === 'F' ? 'زن' : '';
            }
            
            debugLogger('Form auto-filled from passport info', 'success', formData);
            
        } catch (error) {
            debugLogger('Error auto-filling form', 'error', error);
        }
        
        return formData;
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    try {
        debugLogger('Passport OCR module loaded', 'success');
    } catch (error) {
        console.error('Error loading Passport OCR module:', error);
    }
});
