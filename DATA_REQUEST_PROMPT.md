# المطلوب من Claude لمحتوى SEA قبل التوصيل النهائي

أرسل هذا الطلب إلى **Claude** مع ملفات تدقيق Claude وAntigravity وملفات الموقع المتوفرة. إذا كانت الملفات عند Antigravity فقط، استخدم النص نفسه هناك. المطلوب استخراج واعتماد المحتوى، وليس تعديل المشروع أو إنشاء معلومات من عندك.

```text
أعمل على تحويل موقع الأكاديمية السعودية للترفيه (SEA) إلى موقع عربي/إنجليزي ولوحة إدارة. راجع كل ملفات التدقيق والبيانات المرفقة ذات الصلة بالموقع. لا تعدّل الكود ولا تضع أسرار أو مفاتيح حسابات في المخرجات.

أحتاج مخرجين:

1) ملف sea-content-review.json صالح للـJSON، منظم بهذا الشكل:
{
  "siteSettings": {
    "brand": {"headerLogo": null, "footerLogo": null, "favicon": null, "colors": null, "arabicFont": null, "englishFont": null},
    "contact": {"phoneAr": null, "phoneEn": null, "email": null, "addressAr": null, "addressEn": null, "socialLinks": []},
    "navigation": [],
    "seo": {"siteTitleAr": null, "siteTitleEn": null, "descriptionAr": null, "descriptionEn": null}
  },
  "pages": [{"route": "", "titleAr": null, "titleEn": null, "metaDescriptionAr": null, "metaDescriptionEn": null, "sections": [{"type": "hero|text|cards|steps|faq|form|media|cta", "titleAr": null, "titleEn": null, "bodyAr": null, "bodyEn": null, "source": null, "approval": "approved|needs_review|unknown"}]}],
  "programs": [{"slug": null, "titleAr": null, "titleEn": null, "summaryAr": null, "summaryEn": null, "status": null, "duration": null, "hours": null, "fees": null, "startDate": null, "requirementsAr": [], "requirementsEn": [], "applicationUrl": null, "source": null, "approval": "approved|needs_review|unknown"}],
  "applicationForm": {"fields": [], "privacyConsentAr": null, "privacyConsentEn": null, "confirmationAr": null, "confirmationEn": null, "source": null},
  "faqs": [{"questionAr": null, "questionEn": null, "answerAr": null, "answerEn": null, "source": null}],
  "policies": [{"slug": null, "titleAr": null, "titleEn": null, "officialUrl": null, "officialVersion": null, "fullTextAr": null, "fullTextEn": null, "translationStatus": "approved|draft|missing", "source": null}],
  "media": [{"asset": null, "altAr": null, "altEn": null, "captionAr": null, "captionEn": null, "intendedUse": null, "rights": "confirmed|unknown", "source": null}],
  "adminRoles": [{"role": null, "canManage": [], "approval": "approved|needs_review|unknown"}],
  "openQuestions": []
}

2) ملف SEA_CONTENT_REVIEW.md فيه:
- كل الصفحات والبرامج التي لا يوجد لها محتوى إنجليزي رسمي، مع اقتراح ترجمة أولية منفصل بوضوح عن النص المعتمد.
- كل تعارضات الهاتف، روابط التواصل، حالة البرامج، مواعيد/رسوم الدورات، وقنوات التقديم.
- النصوص القانونية/شروط القبول التي تحتاج اعتمادًا بشريًا؛ لا تترجمها وكأنها نسخة رسمية.
- قائمة الأصول الإعلامية التي لا يمكن ربطها بمكان محدد أو لا توجد لها حقوق استخدام مؤكدة.
- قائمة قصيرة بالأسئلة التي يجب أن يجيب عنها العميل، دون تكرار المعلومات المحسومة.

لكل معلومة واقعية أرفق مصدرها (ملف/صفحة/رابط) وتاريخها إن وجد. لا تخمّن. استخدم null أو "unknown" عند غياب الدليل. لا تضع مفاتيح Firebase أو Cloudinary أو كلمات مرور أو بيانات شخصية حقيقية. لا ترفع ملفات، ولا ترسل نماذج، ولا تغيّر أي موقع حي.
```

## مطلوب من صاحب الحساب عند بدء الربط

- إنشاء/تحديد مشروع Firebase للإنتاج واسم/منطقة مشروع Firestore.
- تحديد Cloudinary cloud name وAPI key، ووضع `API secret` في إعداد أسرار الخادم فقط.
- دعوة حسابات المدراء وعناوين بريدهم وتحديد الدور لكل شخص.
- تأكيد النطاق وخدمة الاستضافة. لا ترسل أسرار Firebase Admin أو Cloudinary داخل المحادثة؛ نضعها في `.env.local` غير المتتبع أو Secret Manager.
