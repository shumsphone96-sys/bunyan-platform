import express from 'express';

const originalJson = express.json;
const originalUrlencoded = express.urlencoded;

// توحيد حدود استقبال JSON وحقول النماذج إلى 10MB قبل إنشاء التطبيق.
express.json = function patchedJson(options = {}) {
  return originalJson({ ...options, limit: '10mb' });
};

express.urlencoded = function patchedUrlencoded(options = {}) {
  return originalUrlencoded({ extended: true, ...options, limit: '10mb' });
};
