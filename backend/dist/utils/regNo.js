"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNextRegNo = getNextRegNo;
exports.previewNextRegNo = previewNextRegNo;
/**
 * Utility for smart auto-incrementing registration numbers.
 *
 * Supports two formats:
 *  1. Pure numeric:        "1" → "2",  "500" → "501"
 *  2. Prefix + number:     "LIB-001" → "LIB-002",  "REG-123" → "REG-124"
 *                          "ST001"   → "ST002",     "ABC-999" → "ABC-1000"
 *
 * Zero-padding is preserved for the prefix+number format, but not grown beyond
 * the original width (e.g. LIB-099 → LIB-100, not LIB-0100).
 */
function getNextRegNo(lastRegNo) {
    // If nothing is set, start from 1
    if (!lastRegNo || !lastRegNo.trim())
        return '1';
    const trimmed = lastRegNo.trim();
    // Match: optional non-digit prefix + trailing digits
    // e.g.  "500"      → prefix=""   numStr="500"
    //        "LIB-001"  → prefix="LIB-"  numStr="001"
    //        "ST007"    → prefix="ST"    numStr="007"
    const match = trimmed.match(/^(.*?)(\d+)$/);
    if (!match) {
        // Doesn't end in digits — just append "-1"
        return `${trimmed}-1`;
    }
    const prefix = match[1]; // e.g. "LIB-"
    const numStr = match[2]; // e.g. "001"
    const currentNum = parseInt(numStr, 10);
    const nextNum = currentNum + 1;
    if (!prefix) {
        // Pure numeric format — no padding
        return String(nextNum);
    }
    // Prefix format — preserve zero-padding up to original width
    const padLen = numStr.length;
    const paddedNext = String(nextNum).padStart(padLen, '0');
    return `${prefix}${paddedNext}`;
}
/**
 * Previews what the next registration number will look like
 * given the current lastRegNo string.
 */
function previewNextRegNo(lastRegNo) {
    return getNextRegNo(lastRegNo || null);
}
