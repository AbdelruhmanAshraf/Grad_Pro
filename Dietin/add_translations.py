import json
import os

files = {
    'en': 'src/i18n/locales/en.json',
    'ar': 'src/i18n/locales/ar-EG.json'
}

translations = {
    'en': {
        "slide1_title": "Welcome",
        "slide1_subtitle": "your fitness and nutrition companion",
        "slide2_title": "Track progress",
        "slide2_subtitle": "Work out meals and insights",
        "slide3_title": "Personalized plan",
        "slide3_subtitle": "Customized diet and workout plan",
        "slide4_title": "Achieve your goals",
        "slide4_subtitle": "Stay motivated and achieve your goals",
        "continue": "Continue",
        "get_started": "Get Started"
    },
    'ar': {
        "slide1_title": "مرحباً بك",
        "slide1_subtitle": "رفيقك في اللياقة والتغذية",
        "slide2_title": "تتبع تقدمك",
        "slide2_subtitle": "وجبات التمارين والرؤى",
        "slide3_title": "خطة شخصية",
        "slide3_subtitle": "نظام غذائي وخطة تمارين مخصصة",
        "slide4_title": "حقق أهدافك",
        "slide4_subtitle": "ابق متحمساً وحقق أهدافك",
        "continue": "متابعة",
        "get_started": "ابدأ الآن"
    }
}

for lang, filepath in files.items():
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'onboarding' not in data:
            data['onboarding'] = {}
            
        data['onboarding'].update(translations[lang])
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
print("Translations added successfully.")
