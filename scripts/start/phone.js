import { filledName } from '/scripts/start/start.js';
import { keys } from '/scripts/start/start.js';

export { currentCountry }

const countries = [
    { code: "+7", flag: "russia.png", name: "Россия" },
    { code: "+375", flag: "belarus.png", name: "Беларусь" },
    { code: "+380", flag: "ukraine.png", name: "Украина" },
    { code: "+1", flag: "usa.png", name: "США" },
    { code: "+44", flag: "uk.png", name: "Великобритания" },
    // { code: "+49", flag: "germany.png", name: "Германия" },
    // { code: "+33", flag: "france.png", name: "Франция" },
    // { code: "+86", flag: "china.png", name: "Китай" },
    // { code: "+91", flag: "india.png", name: "Индия" },
    // { code: "+81", flag: "japan.png", name: "Япония" },
    // { code: "+82", flag: "korea.png", name: "Корея" },
    // { code: "+77", flag: "kazakhstan.png", name: "Казахстан" }
];
const countrySelector = document.querySelector('.country-selector');
const selectedCountry = document.querySelector('.selected-country');
const countryDropdown = document.querySelector('.country-dropdown');
export const phoneInput = document.querySelector('#phone-input');
const phonePlaceholder = document.querySelector('.phone-placeholder');
let currentCountry = countries[0];

phoneInput.addEventListener('input', filledName, false)
phoneInput.addEventListener('keydown', keys)

function renderCountryList() {
    countryDropdown.innerHTML = '';
    countries.forEach(country => {
        const option = document.createElement('div');
        option.className = `country-option ${country.code === currentCountry.code ? 'selected' : ''}`;
        option.innerHTML = `
            <img class="flag" src="imgs/${country.flag}" alt="${country.name}">
            <span class="code">${country.code}</span>
            <span class="country-name">${country.name}</span>
        `;
        option.addEventListener('click', () => {
            selectCountry(country);
            closeDropdown();
        });
        countryDropdown.appendChild(option);
    });
}
function selectCountry(country) {
    currentCountry = country;
    selectedCountry.innerHTML = `
        <img class="flag" src="imgs/${country.flag}" alt="${country.name}">
        <span class="code">${country.code}</span>
    `;
    renderCountryList();
}
function toggleDropdown() {
    if (countryDropdown.classList.contains('show'))
        countryDropdown.classList.add('hide')
    else
        countryDropdown.classList.remove('hide')
    countryDropdown.classList.toggle('show')
}
function closeDropdown() {
    if (countryDropdown.classList.contains('show'))
        countryDropdown.classList.add('hide')
    setTimeout(() => {
        countryDropdown.classList.remove('show');
    }, 300)
    countryDropdown.classList.remove('show');
}
function countDigits(value) {
    return value.replace(/\D/g, '').length;
}
function updateDigitCounter(value) {
    const digits = countDigits(value);

}
function startsWithSevenOrEight(str) {
    const digits = str.replace(/\D/g, '');
    return digits.length > 0 && /^[78]/.test(digits);
}
function isOnlySevenOrEight(str) {
    const digits = str.replace(/\D/g, '');
    return digits.length === 1 && /^[78]$/.test(digits);
}
function removeLeadingSevenOrEight(str) {
    const digits = str.replace(/\D/g, '');
    if (/^[78]/.test(digits)) {
        return digits.substring(1);
    }
    return digits;
}
function formatPhoneNumber(value) {
    const numbers = value.replace(/\D/g, '');
    const limitedNumbers = numbers.slice(0, 10);
    let formatted = '';
    for (let i = 0; i < limitedNumbers.length; i++) {
        if (i === 3) {
            formatted += ' ';
        } else if (i === 6 || i === 8) {
            formatted += '-';
        }
        formatted += limitedNumbers[i];
    }
    return formatted;
}
function handlePhoneInput(e) {
    const input = e.target;
    let value = input.value;
    const currentDigits = value.replace(/\D/g, '');
    const cursorPosition = input.selectionStart;
    if (currentDigits.length <= 1 && /^[78]$/.test(currentDigits)) {
        input.value = '';
        updateDigitCounter('');
        phonePlaceholder.classList.remove('hidden');
        input.setSelectionRange(0, 0);
        return;
    }
    const digitsCount = countDigits(value);
    if (digitsCount >= 10) {
        const newDigitsCount = countDigits(value);
        if (newDigitsCount > 10) {
            const previousDigits = currentDigits.slice(0, 10);
            input.value = formatPhoneNumber(previousDigits);
            const formatted = formatPhoneNumber(previousDigits);
            const newCursorPosition = Math.min(cursorPosition, formatted.length);
            input.setSelectionRange(newCursorPosition, newCursorPosition);
            updateDigitCounter(previousDigits);
            return;
        }
    }
    const formatted = formatPhoneNumber(currentDigits);
    input.value = formatted;
    let newCursorPosition = cursorPosition;
    if (cursorPosition < value.length) {
        const beforeCursor = value.substring(0, cursorPosition);
        const digitsBeforeCursor = beforeCursor.replace(/\D/g, '').length;
        let pos = 0;
        let digitCount = 0;
        for (let i = 0; i < formatted.length && digitCount < digitsBeforeCursor; i++) {
            if (/\d/.test(formatted[i])) {
                digitCount++;
            }
            pos = i + 1;
        }
        newCursorPosition = pos;
    } else {
        newCursorPosition = formatted.length;
    }
    input.setSelectionRange(newCursorPosition, newCursorPosition);
    phonePlaceholder.classList.toggle('hidden', formatted.length > 0);
    updateDigitCounter(currentDigits);
}
function handlePhoneKeyDown(e) {
    const input = e.target;
    const value = input.value;
    const digits = value.replace(/\D/g, '');
    if (digits.length >= 10 && /^\d$/.test(e.key)) {
        e.preventDefault();
        return;
    }
    const allowedKeys = [
        'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
        'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End'
    ];
    if (allowedKeys.includes(e.key)) {
        return;
    }
    if (e.ctrlKey || e.metaKey) {
        return;
    }
    if (!/^\d$/.test(e.key)) {
        e.preventDefault();
    }
}
function handlePhonePaste(e) {
    e.preventDefault();
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    let pastedDigits = pastedText.replace(/\D/g, '');
    const currentValue = phoneInput.value.replace(/\D/g, '');
    if (currentValue === '' && isOnlySevenOrEight(pastedText)) {
        return;
    }
    if (startsWithSevenOrEight(pastedText)) {
        pastedDigits = removeLeadingSevenOrEight(pastedText);
        if (pastedDigits.length === 0) {
            return;
        }
    }
    const input = e.target;
    const currentFormatted = input.value;
    const cursorPosition = input.selectionStart;
    const beforeCursor = currentFormatted.substring(0, cursorPosition);
    const afterCursor = currentFormatted.substring(cursorPosition);
    const digitsBefore = beforeCursor.replace(/\D/g, '');
    const digitsAfter = afterCursor.replace(/\D/g, '');
    let allDigits = digitsBefore + pastedDigits + digitsAfter;
    allDigits = allDigits.slice(0, 10);
    const formatted = formatPhoneNumber(allDigits);
    input.value = formatted;
    const insertedDigitsLength = Math.min(pastedDigits.length, 10 - digitsBefore.length - digitsAfter.length);
    const newFormattedBefore = formatPhoneNumber(digitsBefore + pastedDigits.slice(0, insertedDigitsLength));
    const newCursorPosition = newFormattedBefore.length;
    input.setSelectionRange(newCursorPosition, newCursorPosition);
    updateDigitCounter(allDigits);
    phonePlaceholder.classList.toggle('hidden', formatted.length > 0);
}
function handlePhoneChange(e) {
    const input = e.target;
    const value = input.value;
    if (startsWithSevenOrEight(value)) {
        const cleanedDigits = removeLeadingSevenOrEight(value);
        const formatted = formatPhoneNumber(cleanedDigits);
        input.value = formatted;
        updateDigitCounter(cleanedDigits);
        phonePlaceholder.classList.toggle('hidden', formatted.length > 0);
    }
}
function init() {
    renderCountryList();
    countrySelector.addEventListener('click', (e) => {
        if (!countryDropdown.contains(e.target)) {
            toggleDropdown();
        }
    });
    document.addEventListener('click', (e) => {
        if (!countrySelector.contains(e.target)) {
            closeDropdown();
        }
    });
    phoneInput.addEventListener('input', handlePhoneInput);
    phoneInput.addEventListener('keydown', handlePhoneKeyDown);
    phoneInput.addEventListener('paste', handlePhonePaste);
    phoneInput.addEventListener('change', handlePhoneChange);
    phoneInput.addEventListener('focus', () => {
        phonePlaceholder.classList.add('hidden');
    });
    phoneInput.addEventListener('blur', () => {
        phonePlaceholder.classList.toggle('hidden', phoneInput.value.length > 0);
        const value = phoneInput.value;
        if (startsWithSevenOrEight(value)) {
            const cleanedDigits = removeLeadingSevenOrEight(value);
            phoneInput.value = formatPhoneNumber(cleanedDigits);
            updateDigitCounter(cleanedDigits);
        }
    });
    phoneInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDropdown();
        }
    });
    updateDigitCounter('');
}
document.addEventListener('DOMContentLoaded', init);