'use client';

import { useState, useRef } from 'react';

export default function ImageUpload({ currentUrl, onUpload }) {
  const [preview, setPreview] = useState(currentUrl || null);
  const [status, setStatus] = useState('idle'); // 'idle' | 'uploading' | 'done'
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);

    setStatus('uploading');

    Promise.resolve(onUpload(file))
      .then(() => setStatus('done'))
      .catch(() => setStatus('idle'));
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 cursor-pointer transition-colors ${
          dragOver
            ? 'border-brand-400 bg-brand-50'
            : 'border-gray-200 bg-gray-50 hover:border-brand-300 hover:bg-brand-50/50'
        }`}
      >
        {preview ? (
          <div className="relative w-full">
            <img
              src={preview}
              alt="Preview"
              className="mx-auto max-h-48 rounded-xl object-contain"
            />
            {status === 'uploading' && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60 backdrop-blur-sm">
                <svg className="h-8 w-8 animate-spin text-brand-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
            {status === 'done' && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-green-50/60 backdrop-blur-sm">
                <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}
            <p className="mt-3 text-center text-xs text-gray-500">
              Нажмите или перетащите для замены
            </p>
          </div>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-500 mb-3">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">
              Нажмите или перетащите изображение
            </p>
            <p className="mt-1 text-xs text-gray-400">
              PNG, JPG, WebP до 5 МБ
            </p>
          </>
        )}
      </div>
    </div>
  );
}
