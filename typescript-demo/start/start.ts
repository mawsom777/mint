import { phoneInput, currentCountry } from '../start/phone.ts';
import { tokenManager } from '../token-manager.ts';
import { apiRequest } from '../api-client.ts';

export { keys, filledName, getElement }

function showAppScreen () : void {
    // в оригинальнлм файле есть, тут для заглушки
}

function getElement <T extends HTMLElement>(selector: string) : T {
    let obj = document.querySelector<T>(selector)
    if (obj)
        return obj
    else
        throw new Error(`Element not found: ${selector}`)
}

const loginInp = getElement<HTMLInputElement>('.login-inp')
const passInp = getElement<HTMLInputElement>('.pass-inp')
const nameInp = getElement<HTMLInputElement>('.name-inp')
const phoneInp = getElement<HTMLInputElement>('.phone-inp')
const info = getElement<HTMLElement>('.info')
const nextBtn = getElement<HTMLButtonElement>('.nextBtn')
const textAvatar = getElement<HTMLElement>('.text-avatar')
const loading = getElement<HTMLElement>('.loading')
const loginTipSmall = getElement<HTMLElement>('.login-tip-small')
const loginTipBig = getElement<HTMLElement>('.login-tip-big')
const passTipSmall = getElement<HTMLElement>('.pass-tip-small')
const passTipBig = getElement<HTMLElement>('.pass-tip-big')
const loginTipChars = getElement<HTMLElement>('.login-tip-chars')
let registration = false
let timer : number

nextBtn.disabled = true
nextBtn.addEventListener('click', () => {
    check()
})
loginInp.addEventListener('input', filledMain, false)
loginInp.addEventListener('keydown', keys)
passInp.addEventListener('input', filledMain, false)
passInp.addEventListener('keydown', keys)
nameInp.addEventListener('input', filledName, false)
nameInp.addEventListener('keydown', keys)
nameInp.addEventListener('input', generateAvatar, false)
function generateAvatar() : void {
    if (nameInp.value[0] !== undefined)
        textAvatar.textContent = nameInp.value[0].toUpperCase()
    else
        textAvatar.textContent = ''
}

function keys(e: KeyboardEvent) : void {
    const passInpValue = passInp.value
    const nameInpValue = nameInp.value
    const phoneInpValue = phoneInp.value
    if (e.target === nameInp && (e.key === 'Enter' || e.key === 'ArrowDown')) {
        phoneInput.focus()
        setTimeout(() => {phoneInput.setSelectionRange(phoneInpValue.length, phoneInpValue.length)}, 0)
    } else if(e.target === phoneInput && e.key === 'ArrowUp') {
        nameInp.focus()
        setTimeout(() => {nameInp.setSelectionRange(nameInpValue.length, nameInpValue.length)}, 0)
    } else if (!nextBtn.disabled && e.key === 'Enter') {
        check()
    } else if(e.target === loginInp && (e.key === 'Enter' || e.key === 'ArrowDown')) {
        passInp.focus()
        setTimeout(() => {passInp.setSelectionRange(passInpValue.length, passInpValue.length)}, 0)
    } else if(e.target === passInp && e.key === 'ArrowUp') {
        loginInp.focus()
        setTimeout(() => {loginInp.setSelectionRange(loginInp.value.length, loginInp.value.length)}, 0)
    }
}

info.onmouseover = () => {
    const infoBack = getElement<HTMLElement>('.info-back')
    infoBack.classList.add('show')
    infoBack.classList.remove('hide')
}
info.onmouseout = () => {
    const infoBack = getElement<HTMLElement>('.info-back')
    infoBack.classList.remove('show')
    infoBack.classList.add('hide')
}

function filledMain() : void {
    clearTimeout(timer)

    const loginInpValue = loginInp.value.trim()
    const pasInpValue = passInp.value

    const lengthOk = (loginInpValue.length >= 3 && loginInpValue.length < 35) && (pasInpValue.length >= 8 && pasInpValue.length < 72)
    const charsOk = loginInpValue === '' || /^[a-z0-9_]+$/.test(loginInpValue)

    nextBtn.disabled = !(lengthOk && charsOk)

    timer = setTimeout(() => {
        const tips = [loginTipSmall, loginTipBig, passTipSmall, passTipBig, loginTipChars]
        tips.forEach(tip => {
            tip.classList.add('hide')
        })

        if (loginInpValue.length > 0) {
            if (loginInpValue.length < 3) {
                loginTipSmall.classList.remove('hide')
                loginTipSmall.classList.add('show')
            } else if (loginInpValue.length >= 35) {
                loginTipBig.classList.remove('hide')
                loginTipBig.classList.add('show')
            } else if (!/^[a-z0-9_]+$/.test(loginInpValue)) {
                loginTipChars.classList.remove('hide')
                loginTipChars.classList.add('show')
            }
        }

        if (pasInpValue.length > 0) {
            if (pasInpValue.length < 8) {
                passTipSmall.classList.remove('hide')
                passTipSmall.classList.add('show')
            } else if (pasInpValue.length > 72) {
                passTipBig.classList.remove('hide')
                passTipBig.classList.add('show')
            }
        }
    }, 500)
}

function filledName() : void {
    const nameLength = nameInp.value.length > 0 && nameInp.value.length <= 45
    const phoneLength = phoneInp.value.length === 13 || phoneInp.value.length === 0
    nextBtn.disabled = ! (phoneLength && nameLength)
}

async function check() {
    phoneInp.classList.remove('invalid')
    passInp.classList.remove('invalid')
    loginInp.classList.remove('invalid')


    const loginInpValue : string = loginInp.value
    const passInpValue : string = passInp.value
    const nameInpValue : string = nameInp.value
    const phoneInpValue : string = phoneInp.value

    let data : Record<string, unknown>

    if (registration && phoneInput.value.length > 0)
        data = {loginInp: loginInpValue.trim(), pass: passInpValue, name: nameInpValue, phone: currentCountry['code'].substring(1) + phoneInpValue.replace(/\D/g, '')}
    else if (registration)
        data = {loginInp: loginInpValue.trim(), pass: passInpValue, name: nameInpValue}
    else
        data = {loginInp: loginInpValue.trim(), pass: passInpValue}

    loading.classList.remove('inactive')
    loading.classList.add('active')

    interface checkLoginInterface {
        result: number
        redirect: boolean
        jwt: {access_token: string, refresh_token: string}
    }
    const checkLogin : checkLoginInterface = (await apiRequest<checkLoginInterface>(checkLoginPHP, data))['data']

    loading.classList.add('inactive')
    loading.classList.remove('active')

    enum LoginResult { 
        WrongLogin = 1, 
        WrongPassword = 2, 
        Registering = 3,
        PhoneOccupated = 5
    }

    const result = checkLogin['result']
    const redirect = checkLogin['redirect']
    const jwt = checkLogin['jwt']

    if (redirect) {
        await tokenManager.setAccessToken(jwt['access_token']);
        await tokenManager.setRefreshToken(jwt['refresh_token']);
        await showAppScreen();
    }

    if (result === LoginResult.WrongLogin) {  // Телефон занят
        phoneInp.classList.remove('invalid')
        phoneInp.classList.add('invalid')
    } else if (result === LoginResult.Registering) {  // Регистрация
        registration = true;

        nextBtn.disabled = true
        loginInp.disabled = true
        passInp.disabled = true

        const windowObj = getElement<HTMLElement>('.window')
        const windowContainer = getElement<HTMLElement>('.window-container')
        const loginRow = getElement<HTMLElement>('.login-row')
        const passRow = getElement<HTMLElement>('.pass-row')

        windowObj.classList.remove('reg')
        windowObj.classList.add('reg')
        windowContainer.classList.remove('reg')
        windowContainer.classList.add('reg')
        loginRow.classList.remove('reg')
        loginRow.classList.add('reg')
        passRow.classList.remove('reg')
        passRow.classList.add('reg')

        setTimeout(() => {
            const regTitle = getElement<HTMLElement>('.reg-title')
            const nameRow = getElement<HTMLElement>('.name-row')
            const phoneRow = getElement<HTMLElement>('.phone-row')
            const phoneTitle = getElement<HTMLElement>('.phone-title')

            regTitle.classList.add('reg')
            nameRow.classList.add('reg')
            phoneRow.classList.add('reg')
            phoneTitle.classList.add('reg')
            nameInp.focus()
        }, 275);
    } else if (result === LoginResult.WrongPassword) {  // Направильный пароль
        passInp.classList.add('invalid')
    } else if (result === LoginResult.WrongLogin) {  // Ошибка при вводе логина
        loginInp.classList.add('invalid')
    }
}

filledMain()
filledName()

// Пасхалка :)
let counter = 0
const regTitle = getElement<HTMLElement>('.reg-title')
const gayCheck = getElement<HTMLInputElement>('.gay-checkbox')
const gayTitle = getElement<HTMLElement>('.gay-title')
regTitle.onclick = () => {
    counter++
    if (counter >= 15) {
        const gayRow = getElement<HTMLElement>('.gay-row')
        gayRow.classList.add('active')
        regTitle.classList.remove('clickable')
    }
}
gayCheck.addEventListener('change', () => {
    if (gayCheck.checked)
        gayTitle.innerHTML = 'Убери галочку если не гей'
    else
        gayTitle.innerHTML = 'Поставь галочку если не гей'
})
