'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

export interface FAQItem {
  qEn: string;
  qUr: string;
  aEn: string;
  aUr: string;
}

export const FAQS: FAQItem[] = [
  {
    qEn: 'What is Anime Urdu (پاک Anime)?',
    qUr: 'Anime Urdu (پاک Anime) کیا ہے؟',
    aEn: 'Anime Urdu is Pakistan\'s dedicated platform to stream popular anime series and movies in high quality (1080p Full HD) with Urdu and Hindi dubbed audio as well as English and Japanese subbed options.',
    aUr: 'Anime Urdu پاکستان کا ایک خصوصی آن لائن پلیٹ فارم ہے جہاں آپ تمام مشہور اینیمے سیریز اور موویز اردو اور ہندی ڈبنگ کے ساتھ ساتھ انگلش اور جاپانی میں فل ایچ ڈی (1080p) کوالٹی میں بالکل مفت دیکھ سکتے ہیں۔'
  },
  {
    qEn: 'Is watching anime on Anime Urdu completely free?',
    qUr: 'کیا Anime Urdu پر اینیمے دیکھنا بالکل مفت ہے؟',
    aEn: 'Yes, 100% free! You do not need any paid subscription or login to watch your favorite anime series, movies, and cartoons.',
    aUr: 'جی ہاں، بالکل مفت! آپ کو اپنی پسندیدہ اینیمے سیریز، موویز اور کارٹونز دیکھنے کے لیے کسی رجسٹریشن یا ادا شدہ سبسکرپشن کی ضرورت نہیں ہے۔'
  },
  {
    qEn: 'Which popular anime titles are available in Urdu & Hindi?',
    qUr: 'کون کون سے مشہور اینیمے اردو اور ہندی میں دستیاب ہیں؟',
    aEn: 'Our catalog of 510+ anime includes global favorites such as Naruto, Naruto Shippuden, Attack on Titan, Death Note, Jujutsu Kaisen, Chainsaw Man, Solo Leveling, Demon Slayer, Doraemon, Shinchan, Ben 10, Dragon Ball Z, and many more.',
    aUr: 'ہماری 510 سے زائد اینیمے لائبریری میں ناروٹو، ڈیتھ نوٹ، اٹیک آن ٹائٹن، جوجوتسو کائیسن، چین سا مین، ڈوریمون، شن چین، بین 10، ڈریگن بال زی اور سولو لیولنگ سمیت تمام بڑے بلاک بسٹرز شامل ہیں۔'
  },
  {
    qEn: 'Can I install Anime Urdu as an app on Android and iPhone?',
    qUr: 'کیا میں Anime Urdu کو اپنے اینڈرائیڈ یا آئی فون پر ایپ کی طرح انسٹال کر سکتا ہوں؟',
    aEn: 'Yes! Anime Urdu is built as a Progressive Web App (PWA). Simply tap "Add to Home Screen" or the install banner to use it just like a native mobile app with instant loading and fluid navigation.',
    aUr: 'جی ہاں! Anime Urdu مکمل پروگریسو ویب ایپ (PWA) کو سپورٹ کرتا ہے۔ اپنے براؤزر میں "Add to Home Screen" دبائیں اور اسے بغیر کسی ایپ اسٹور ڈاؤن لوڈ کے موبائل ایپ کی طرح استعمال کریں۔'
  },
  {
    qEn: 'How frequently is new anime content updated?',
    qUr: 'نئے اینیمے ایپی سوڈز کتنی جلدی اپ ڈیٹ ہوتے ہیں؟',
    aEn: 'Our automated synchronization engine continuously checks for new episode releases and movies from origin servers, enriching them with high-definition multi-audio stream servers in real-time.',
    aUr: 'ہمارا خودکار انجن مسلسل نئے ایپی سوڈز اور موویز کی جانچ کرتا ہے اور اوریجنل اسٹریمنگ سرورز سے نئی ریلیزز کو فوری طور پر ویب سائٹ میں شامل کرتا ہے۔'
  },
  {
    qEn: 'How do I switch between Urdu, Hindi, English, and Japanese audio tracks?',
    qUr: 'میں اردو، ہندی، انگلش اور جاپانی آڈیو ٹریکس کیسے تبدیل کروں؟',
    aEn: 'On the video watch page, our VIP Multi-Audio player allows you to switch audio tracks directly within the player controls or choose your preferred language mirror with one click.',
    aUr: 'ویڈیو واچ پیج پر موجود ملٹی آڈیو پلیئر آپ کو پلیئر کے اندر یا سرور لسٹ سے ایک کلک کے ساتھ اردو، ہندی، انگلش اور جاپانی آڈیو کو منتخب کرنے کی سہولت فراہم کرتا ہے۔'
  }
];

export default function FAQSection() {
  const { language } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0); // First item open by default

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section 
      aria-label="Frequently Asked Questions (FAQ)"
      style={{
        marginTop: '32px',
        marginBottom: '28px',
      }}
    >
      <div className="glass-panel" style={{
        padding: 'clamp(24px, 4vw, 36px) clamp(16px, 3vw, 28px)',
        borderRadius: '20px',
        background: 'var(--glass-bg)',
        border: '1.5px solid var(--glass-border)',
      }}>
        {/* Section Heading */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(0, 102, 51, 0.1)',
            color: 'var(--color-primary)',
            padding: '4px 12px',
            borderRadius: '9999px',
            fontSize: '0.78rem',
            fontWeight: 800,
            marginBottom: '8px',
            border: '1px solid rgba(0, 102, 51, 0.18)',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>help_outline</span>
            <span>{language === 'ur' ? 'اکثر پوچھے گئے سوالات' : 'FAQ & Knowledge Base'}</span>
          </div>

          <h2 style={{
            fontSize: 'clamp(1.25rem, 3vw, 1.65rem)',
            fontWeight: 900,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
          }}>
            {language === 'ur' ? 'عام طور پر پوچھے جانے والے سوالات' : 'Frequently Asked Questions'}
          </h2>
          <p style={{
            fontSize: '0.88rem',
            color: 'var(--text-secondary)',
            marginTop: '6px',
            maxWidth: '560px',
            marginInline: 'auto',
            lineHeight: 1.5,
          }}>
            {language === 'ur' 
              ? 'Anime Urdu پر اینیمے اسٹریمنگ، آڈیو زبانوں اور ایپ انسٹالیشن سے متعلق تمام معلومات۔'
              : 'Everything you need to know about streaming anime in Urdu & Hindi, app features, and video quality.'}
          </p>
        </div>

        {/* Accordion FAQ Items */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxWidth: '820px',
          marginInline: 'auto',
        }}>
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            const question = language === 'ur' ? faq.qUr : faq.qEn;
            const answer = language === 'ur' ? faq.aUr : faq.aEn;

            return (
              <div 
                key={idx}
                style={{
                  borderRadius: '14px',
                  border: isOpen ? '1.5px solid var(--color-primary)' : '1px solid var(--glass-border)',
                  background: isOpen ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                  boxShadow: isOpen ? '0 8px 24px rgba(0, 0, 0, 0.3)' : '0 2px 8px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  overflow: 'hidden',
                }}
              >
                {/* Question Trigger Button */}
                <button
                  onClick={() => toggle(idx)}
                  aria-expanded={isOpen}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: language === 'ur' ? 'right' : 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    color: isOpen ? 'var(--color-primary)' : 'var(--text-primary)',
                    lineHeight: 1.4,
                    flex: 1,
                  }}>
                    {question}
                  </span>
                  
                  <span 
                    className="material-symbols-outlined" 
                    style={{
                      fontSize: '22px',
                      color: isOpen ? 'var(--color-primary)' : 'var(--text-muted)',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.25s ease, color 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    keyboard_arrow_down
                  </span>
                </button>

                {/* Answer Content */}
                {isOpen && (
                  <div style={{
                    padding: '0 20px 18px 20px',
                    fontSize: '0.88rem',
                    lineHeight: 1.65,
                    color: 'var(--text-secondary)',
                    borderTop: '1px solid var(--glass-border)',
                    paddingTop: '12px',
                  }}>
                    {answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
