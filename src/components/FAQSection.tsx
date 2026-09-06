'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

import { FAQS } from '@/data/faqs';

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
        borderRadius: '24px',
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
            padding: '4px 14px',
            borderRadius: '999px',
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
                  borderRadius: '18px',
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
