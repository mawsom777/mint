import { filledName, keys, getElement } from '../start/start.js'

export { currentCountry, phoneInput }

interface country {
    code: string
    flag: string
    name: string
}

const countries : country[] = [
    { code: "+7", flag: "russia.png", name: "Россия" },
    { code: "+375", flag: "belarus.png", name: "Беларусь" },
    { code: "+380", flag: "ukraine.png", name: "Украина" },
    { code: "+1", flag: "usa.png", name: "США" },
    { code: "+44", flag: "uk.png", name: "Великобритания" }
]
let currentCountry : country = countries[0]!

const countrySelector = getElement<HTMLElement>('.country-selector')
const selectedCountry = getElement<HTMLElement>('.selected-country')
const countryDropdown = getElement<HTMLElement>('.country-dropdown')
const phoneInput = getElement<HTMLInputElement>('#phone-input')
const phonePlaceholder = getElement<HTMLElement>('.phone-placeholder')

phoneInput.addEventListener('input', filledName, false)
phoneInput.addEventListener('keydown', keys)

function renderCountryList() {
    countryDropdown.innerHTML = ''
    countries.forEach(country => {
        const option = document.createElement('div')
        option.className = `country-option ${country.code === currentCountry.code ? 'selected' : ''}`
        option.innerHTML = `
            <img class="flag" src="imgs/${country.flag}" alt="${country.name}">
            <span class="code">${country.code}</span>
            <span class="country-name">${country.name}</span>
        `
        option.addEventListener('click', () => {
            selectCountry(country)
            closeDropdown()
        })
        countryDropdown.appendChild(option)
    })
}

function selectCountry (country: country) {
    currentCountry = country
    selectedCountry.innerHTML = `
        <img class="flag" src="imgs/${country.flag}" alt="${country.name}">
        <span class="code">${country.code}</span>
    `
    renderCountryList()
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
        countryDropdown.classList.remove('show')
    }, 300)
}
function countDigits(value: string) {
    return value.replace(/\D/g, '').length
}
function startsWithSevenOrEight(str: string) {
    const digits = str.replace(/\D/g, '')
    return digits.length > 0 && /^[78]/.test(digits)
}
function isOnlySevenOrEight(str: string) {
    const digits = str.replace(/\D/g, '')
    return digits.length === 1 && /^[78]$/.test(digits)
}
function removeLeadingSevenOrEight(str: string) {
    const digits = str.replace(/\D/g, '')
    if (/^[78]/.test(digits)) {
        return digits.substring(1)
    }
    return digits
}
function formatPhoneNumber(value: string) : string {
    const numbers = value.replace(/\D/g, '')
    const limitedNumbers = numbers.slice(0, 10)
    let formatted = ''
    for (let i = 0; i < limitedNumbers.length; i++) {
        if (i === 3) {
            formatted += ' '
        } else if (i === 6 || i === 8) {
            formatted += '-'
        }
        formatted += limitedNumbers[i]
    }
    return formatted
}
function handlePhoneInput(e: Event) {
    const input = e.target as HTMLInputElement
    let value = input.value
    const currentDigits = value.replace(/\D/g, '')
    const cursorPosition = input.selectionStart
    if (cursorPosition === null)
        return
    if (currentDigits.length <= 1 && /^[78]$/.test(currentDigits)) {
        input.value = ''
        phonePlaceholder.classList.remove('hidden')
        input.setSelectionRange(0, 0)
        return
    }
    const digitsCount = countDigits(value)
    if (digitsCount >= 10) {
        const newDigitsCount = countDigits(value)
        if (newDigitsCount > 10) {
            const previousDigits = currentDigits.slice(0, 10)
            input.value = formatPhoneNumber(previousDigits)
            const formatted = formatPhoneNumber(previousDigits)
            const newCursorPosition = Math.min(cursorPosition, formatted.length)
            input.setSelectionRange(newCursorPosition, newCursorPosition)
            return
        }
    }
    const formatted : string = formatPhoneNumber(currentDigits)
    input.value = formatted
    let newCursorPosition = cursorPosition
    if (cursorPosition < value.length) {
        const beforeCursor = value.substring(0, cursorPosition)
        const digitsBeforeCursor = beforeCursor.replace(/\D/g, '').length
        let pos = 0
        let digitCount = 0
        for (let i = 0; i < formatted.length && digitCount < digitsBeforeCursor; i++) {
            const ch = formatted[i];
            if (ch === undefined) continue;
            if (/\d/.test(ch)) {
                digitCount++
            }
            pos = i + 1
        }
        newCursorPosition = pos
    } else {
        newCursorPosition = formatted.length
    }
    input.setSelectionRange(newCursorPosition, newCursorPosition)
    phonePlaceholder.classList.toggle('hidden', formatted.length > 0)
}
function handlePhoneKeyDown(e: KeyboardEvent) {
    const input = e.target as HTMLInputElement
    const value = input.value
    const digits = value.replace(/\D/g, '')
    if (digits.length >= 10 && /^\d$/.test(e.key)) {
        e.preventDefault()
        return
    }
    const allowedKeys = [
        'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
        'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End'
    ]
    if (allowedKeys.includes(e.key)) {
        return
    }
    if (e.ctrlKey || e.metaKey) {
        return
    }
    if (!/^\d$/.test(e.key)) {
        e.preventDefault()
    }
}
function handlePhonePaste(e: ClipboardEvent) {
    e.preventDefault()
    let pastedText : string
    if (e.clipboardData)
        pastedText = (e.clipboardData).getData('text')
    else
        return
    let pastedDigits = pastedText.replace(/\D/g, '')
    const currentValue = phoneInput.value.replace(/\D/g, '')
    if (currentValue === '' && isOnlySevenOrEight(pastedText)) {
        return
    }
    if (startsWithSevenOrEight(pastedText)) {
        pastedDigits = removeLeadingSevenOrEight(pastedText)
        if (pastedDigits.length === 0) {
            return
        }
    }
    const input = e.target as HTMLInputElement
    const currentFormatted = input.value
    const cursorPosition = input.selectionStart
    if (cursorPosition === null)
        return
    const beforeCursor = currentFormatted.substring(0, cursorPosition)
    const afterCursor = currentFormatted.substring(cursorPosition)
    const digitsBefore = beforeCursor.replace(/\D/g, '')
    const digitsAfter = afterCursor.replace(/\D/g, '')
    let allDigits = digitsBefore + pastedDigits + digitsAfter
    allDigits = allDigits.slice(0, 10)
    const formatted = formatPhoneNumber(allDigits)
    input.value = formatted
    const insertedDigitsLength = Math.min(pastedDigits.length, 10 - digitsBefore.length - digitsAfter.length)
    const newFormattedBefore = formatPhoneNumber(digitsBefore + pastedDigits.slice(0, insertedDigitsLength))
    const newCursorPosition = newFormattedBefore.length
    input.setSelectionRange(newCursorPosition, newCursorPosition)
    phonePlaceholder.classList.toggle('hidden', formatted.length > 0)
}
function handlePhoneChange(e: Event) {
    const input = e.target as HTMLInputElement
    const value = input.value
    if (startsWithSevenOrEight(value)) {
        const cleanedDigits = removeLeadingSevenOrEight(value)
        const formatted = formatPhoneNumber(cleanedDigits)
        input.value = formatted
        phonePlaceholder.classList.toggle('hidden', formatted.length > 0)
    }
}
function init() {
    renderCountryList()
    countrySelector.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as Node | null;
        if (!countryDropdown.contains(target)) {
            toggleDropdown()
        }
    })
    document.addEventListener('click', (e) => {
        const target = e.target as Node | null;
        if (!countrySelector.contains(target)) {
            closeDropdown()
        }
    })
    phoneInput.addEventListener('input', handlePhoneInput)
    phoneInput.addEventListener('keydown', handlePhoneKeyDown)
    phoneInput.addEventListener('paste', handlePhonePaste)
    phoneInput.addEventListener('change', handlePhoneChange)
    phoneInput.addEventListener('focus', () => {
        phonePlaceholder.classList.add('hidden')
    })
    phoneInput.addEventListener('blur', () => {
        phonePlaceholder.classList.toggle('hidden', phoneInput.value.length > 0)
        const value = phoneInput.value
        if (startsWithSevenOrEight(value)) {
            const cleanedDigits = removeLeadingSevenOrEight(value)
            phoneInput.value = formatPhoneNumber(cleanedDigits)
        }
    })
    phoneInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDropdown()
        }
    })
}
document.addEventListener('DOMContentLoaded', init)