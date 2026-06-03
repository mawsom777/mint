import { phoneInput, currentCountry } from '/scripts/start/phone.js';
import { tokenManager } from '/scripts/token-manager.js';
import { apiRequest } from '/scripts/api-client.js';
import { showAppScreen } from '/scripts/spa-router.js';

const username = document.querySelector(".login-inp")
const pass = document.querySelector(".pass-inp")
const name = document.querySelector(".name-inp")
const phone = document.querySelector(".phone-inp")
const info = document.querySelector(".info")
const next = document.querySelector(".next")
const textAvatar = document.querySelector(".text-avatar")
const loading = document.querySelector(".loading")
const loginTipSmall = document.querySelector(".login-tip-small")
const loginTipBig = document.querySelector(".login-tip-big")
const passTipSmall = document.querySelector(".pass-tip-small")
const passTipBig = document.querySelector(".pass-tip-big")
const loginTipChars = document.querySelector(".login-tip-chars")
let reg = false
let timer

next.disabled = true
next.addEventListener('click', () => {
    check()
})
username.addEventListener('input', filledMain, false)
username.addEventListener('keydown', keys)
pass.addEventListener('input', filledMain, false)
pass.addEventListener('keydown', keys)
name.addEventListener('input', filledName, false)
name.addEventListener('keydown', keys)
name.addEventListener('input', generateAvatar, false)
function generateAvatar() {
    if (name.value[0] !== undefined)
        return textAvatar.textContent = name.value[0].toUpperCase()
    else
        return textAvatar.textContent = ""
}
export function keys(e) {
    if (e.target === name && (e.key === 'Enter' || e.key === 'ArrowDown')) {
        phoneInput.focus()
        setTimeout(() => {phoneInput.setSelectionRange(phoneInput.value.length, phoneInput.value.length)}, 0)
    } else if(e.target === phoneInput && e.key === 'ArrowUp') {
        name.focus()
        setTimeout(() => {name.setSelectionRange(name.value.length, name.value.length)}, 0)
    } else if (!next.disabled && e.key === 'Enter') {
        check()
    } else if(e.target === username && (e.key === 'Enter' || e.key === 'ArrowDown')) {
        pass.focus()
        setTimeout(() => {pass.setSelectionRange(pass.value.length, pass.value.length)}, 0)
    } else if(e.target === pass && e.key === 'ArrowUp') {
        username.focus()
        setTimeout(() => {username.setSelectionRange(username.value.length, username.value.length)}, 0)  // хз почему, но без таймера (в 0 секунд!) курсор не перемещается
    }
}

info.onmouseover = () => {
    document.querySelector(".info-back").classList.add('show')
    document.querySelector(".info-back").classList.remove('hide')
}
info.onmouseout = () => {
    document.querySelector(".info-back").classList.remove('show')
    document.querySelector(".info-back").classList.add('hide')
}

function filledMain() {
    clearTimeout(timer)

    const usernameVal = username.value.trim()
    const passVal = pass.value

    const lengthOk = usernameVal.length >= 3 && usernameVal.length < 35 && passVal.length >= 8 && passVal.length < 72
    const charsOk = usernameVal === '' || /^[a-z0-9_]+$/.test(usernameVal)

    next.disabled = !(lengthOk && charsOk)

    timer = setTimeout(() => {
        const tips = [loginTipSmall, loginTipBig, passTipSmall, passTipBig, loginTipChars]
        tips.forEach(tip => {
            tip.classList.add('hide')
        })

        if (usernameVal.length > 0) {
            if (usernameVal.length < 3) {
                loginTipSmall.classList.remove('hide')
                loginTipSmall.classList.add('show')
            } else if (usernameVal.length >= 35) {
                loginTipBig.classList.remove('hide')
                loginTipBig.classList.add('show')
            } else if (!/^[a-z0-9_]+$/.test(usernameVal)) {
                loginTipChars.classList.remove('hide')
                loginTipChars.classList.add('show')
            }
        }

        if (passVal.length > 0) {
            if (passVal.length < 8) {
                passTipSmall.classList.remove('hide')
                passTipSmall.classList.add('show')
            } else if (passVal.length > 72) {
                passTipBig.classList.remove('hide')
                passTipBig.classList.add('show')
            }
        }
    }, 500)
}

export function filledName() {
    next.disabled = !(name.value.length > 0 && name.value.length <= 45 && (phoneInput.value.length === 13 || phoneInput.value.length === 0))
}

async function check() {
    phone.classList.remove('invalid')
    pass.classList.remove('invalid')
    username.classList.remove('invalid')

    let data
    if (reg && phoneInput.value.length > 0)
        data = {username: username.value.trim(), pass: pass.value, name: name.value, phone: currentCountry['code'].substring(1) + phoneInput.value.replace(/\D/g, '')}
    else if (reg)
        data = {username: username.value.trim(), pass: pass.value, name: name.value}
    else
        data = {username: username.value.trim(), pass: pass.value}

    loading.classList.remove('inactive')
    loading.classList.add('active')


    const checkLogin = (await apiRequest(checkLoginPHP, data))['data']

    loading.classList.add('inactive')
    loading.classList.remove('active')

    const result = checkLogin["result"]
    const redirect = checkLogin["redirect"]
    const jwt = checkLogin['jwt']

    if (redirect) {
        await tokenManager.setAccessToken(jwt['access_token']);
        await tokenManager.setRefreshToken(jwt['refresh_token']);
        await showAppScreen();
    }

    if (result === 5) {
        phone.classList.remove('invalid')
        phone.classList.add('invalid')
    } else if (result === 3) {  // регистрация
        reg = true;

        next.disabled = true
        username.disabled = true
        pass.disabled = true

        document.querySelector(".window").classList.remove('reg')
        document.querySelector(".window").classList.add('reg')

        document.querySelector(".window-container").classList.remove('reg')
        document.querySelector(".window-container").classList.add('reg')

        document.querySelector(".login-row").classList.remove('reg')
        document.querySelector(".login-row").classList.add('reg')

        document.querySelector(".pass-row").classList.remove('reg')
        document.querySelector(".pass-row").classList.add('reg')

        setTimeout(() => {
            document.querySelector(".reg-title").classList.add('reg')
            document.querySelector(".name-row").classList.add('reg')
            document.querySelector(".phone-row").classList.add('reg')
            document.querySelector(".phone-title").classList.add('reg')
            name.focus()
        }, 275);
    } else if (result === 2) {  // bad пароль
        pass.classList.add('invalid')
    } else if (result === 1) {
        username.classList.add('invalid')
    }
}

filledMain()
filledName()

let counter = 0
document.querySelector(".reg-title").onclick = () => {
    counter++
    if (counter >= 15) {
        document.querySelector('.gay-row').classList.add('active')
        document.querySelector(".reg-title").classList.remove('clickable')
    }
}
document.querySelector(".gay-checkbox").addEventListener("change", () => {
    if (document.querySelector(".gay-checkbox").checked)
        document.querySelector('.gay-title').innerHTML = "Убери галочку если не гей"
    else
        document.querySelector('.gay-title').innerHTML = "Поставь галочку если не гей"
})