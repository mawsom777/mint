import { generateAvatar, addChat, performSearch } from '/scripts/main/main.js';
import { apiRequest } from "/scripts/api-client.js";

let currentChatType = 'group';
let selectedParticipants = new Map();
let modalCurrentSearchMode = 'name'
let pendingAvatarKey = null

const newChatModal = document.querySelector('.new-chat-modal');
const modalTabs = document.querySelectorAll('.modal-tab');
const modalSearchInput = document.querySelector('.modal-search-input');
const modalToggleSearchButton = document.querySelector('.modal-toggle-search');
const modalSearchResults = document.querySelector('.modal-search-results');
const selectedContainer = document.getElementById('selectedParticipants');
const chatTitleInput = document.querySelector('.chat-title-input');
const chatDescriptionInput = document.querySelector('.chat-description-input');
const createButton = document.querySelector('.create-chat-button');
const bandDropdown = document.querySelector('.band-dropdown');
const chatsCreateButton = document.querySelector('.chats-create-button')
const channelSettings = document.querySelector('.modal-channel-settings');
const isPrivateCheckbox = document.getElementById('isPrivateChannel');
const slugInput = document.querySelector('.slug-input');
const slugError = document.querySelector('.slug-error');

document.querySelector('.modal-avatar-img').addEventListener('click', async function(e) {
    e.stopPropagation();
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    fileInput.click();

    fileInput.addEventListener('change', async function() {
        if (fileInput.files.length === 0) {
            document.body.removeChild(fileInput);
            return;
        }
        const file = fileInput.files[0];
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('compress', '0');
            const upload = (await apiRequest(uploadPHP, formData))['data']
            if (upload.success) {
                pendingAvatarKey = upload.file_key;
                const colourDiv = document.querySelector('.modal-colour-avatar');
                if (colourDiv) {
                    colourDiv.style.backgroundImage = `url('${filePHP}?key=${pendingAvatarKey}')`;
                    colourDiv.style.background = '';
                    colourDiv.querySelector('.modal-text-avatar').textContent = '';
                }
            } else {
                console.error('Ошибка загрузки аватара:', upload.error);
            }
        } catch (err) {
            console.error('Ошибка загрузки аватара:', err);
        } finally {
            document.body.removeChild(fileInput);
        }
    });
});

chatsCreateButton.addEventListener('click', () => {
    renderBandList()
    toggleDropdown()
});

document.addEventListener('click', (e) => {
    if (!chatsCreateButton.contains(e.target) && bandDropdown.classList.contains('show')) {
        closeDropdown();
    }
});

document.querySelector('.chat-info-modal-cross').addEventListener('click', (e) => {
    newChatModal.classList.add('closing');
    setTimeout(() => {
        newChatModal.classList.remove('closing');
        newChatModal.style.display = 'none';
    }, 300)
    resetModal();
});

document.querySelector('.new-chat-modal-background').addEventListener('click', () => {
    newChatModal.classList.add('closing');
    setTimeout(() => {
        newChatModal.classList.remove('closing');
        newChatModal.style.display = 'none';
    }, 300)
    resetModal();
});

document.querySelector('.new-chat-modal-cross').addEventListener('click', () => {
    newChatModal.classList.add('closing');
    setTimeout(() => {
        newChatModal.classList.remove('closing');
        newChatModal.style.display = 'none';
    }, 300)
    resetModal();
});

let modalSearchDebounce;
modalSearchInput.addEventListener('input', (e) => {
    clearTimeout(modalSearchDebounce);
    const query = e.target.value.trim();
    if (!query) {
        hideModalSearchResults();
        return;
    }
    modalSearchDebounce = setTimeout(() => performModalSearch(query), 300);
});

modalToggleSearchButton.addEventListener('click', modalToggleSearchMode);

function modalToggleSearchMode() {
    modalCurrentSearchMode = modalCurrentSearchMode === 'name' ? 'phone' : 'name';
    modalSearchInput.placeholder = modalCurrentSearchMode === 'name' ? "Имя пользователя" : "Телефон";
    modalSearchInput.value = '';
    hideModalSearchResults();
    updateToggleSearchIcon();

    modalSearchInput.focus();
}

function updateToggleSearchIcon() {
    if (!modalToggleSearchButton) return;

    const icon = modalToggleSearchButton.querySelector('.switch-img');
    if (icon) {
        icon.alt = modalCurrentSearchMode === 'name' ? 'Искать по телефону' : 'Искать по имени';
    }
}

async function performModalSearch(query) {
    try {
        const searchUsers = (await apiRequest(`${searchUsersPHP}?query=${encodeURIComponent(query.replace('@', ''))}&mode=${query.includes('@') ? 'username' : modalCurrentSearchMode}`))['data']
        displayModalSearchResults(searchUsers);
    } catch (error) {
        console.error('Ошибка поиска:', error);
    }
}

function displayModalSearchResults(users) {
    if (!modalSearchResults) return;
    const colours = [
        '--avatar-gradient-gray',
        '--avatar-gradient-blue',
        '--avatar-gradient-green',
        '--avatar-gradient-purple',
    ]

    if (users.length === 0) {
        modalSearchResults.innerHTML = '<div class="search-result">Ничего не найдено</div>';
    } else {
        modalSearchResults.innerHTML = users.map(user => `
            <div class="search-result" data-user-id="${user.id}" data-user-name="${user.name}" data-user-avatar="${user.avatar_url}">
                <div class="search-result-row">
                    ${colours.includes(user.avatar_url) ? `<div class="search-result-avatar" style="background: var(${user.avatar_url})"> ${generateAvatar(user.name)} </div>` : `<div class="search-result-avatar" style="background-image: url('${user.avatar_url.replace(/'/g, "\\'")}');"></div>`}
                    <div class="search-result-name">${user.name}</div>
                </div>
                ${user.phone ? `<div class="search-result-phone">${user.phone}</div>` : ''}
            </div>
        `).join('');

        document.querySelectorAll('.modal-search-results .search-result').forEach(item => {
            item.addEventListener('click', () => addParticipantFromResult(item));
        });
    }
    modalSearchResults.style.display = 'block';
}

function hideModalSearchResults() {
    if (modalSearchResults) modalSearchResults.style.display = 'none';
}

function addParticipantFromResult(element) {
    const userId = element.dataset.userId;
    const userName = element.dataset.userName;
    const avatar = element.dataset.userAvatar;

    if (selectedParticipants.has(userId)) return;

    selectedParticipants.set(userId, { id: userId, name: userName, avatar });
    renderSelectedParticipants();
    hideModalSearchResults();
    modalSearchInput.value = '';
    updateCreateButtonState();
}

function renderSelectedParticipants() {
    const colours = [
        '--avatar-gradient-gray',
        '--avatar-gradient-blue',
        '--avatar-gradient-green',
        '--avatar-gradient-purple',
    ]
    selectedContainer.innerHTML = '';
    selectedParticipants.forEach(user => {
        const tag = document.createElement('div');
        tag.className = 'participant-tag';
        tag.innerHTML = `
            <div class="participant-tag-avatar" ${colours.includes(user.avatar) ? `style="background: var(${user.avatar})"` : `style="background-image: url('${user.avatar.replace(/'/g, "\\'")}');"`}> ${colours.includes(user.avatar) ? generateAvatar(user.name) : ''}</div>
            <span>${user.name}</span>
            <span class="participant-tag-remove" data-user-id="${user.id}">&times;</span>
        `;
        tag.querySelector('.participant-tag-remove').addEventListener('click', () => {
            selectedParticipants.delete(user.id);
            renderSelectedParticipants();
            updateCreateButtonState();
        });
        selectedContainer.appendChild(tag);
    });
}

function updateCreateButtonState() {
    createButton.disabled = false;
}

function resetModal() {
    selectedParticipants.clear();
    renderSelectedParticipants();
    chatTitleInput.value = '';
    if (currentChatType === 'channel') {
        isPrivateCheckbox.checked = false;
        slugInput.value = '';
        updateSlugVisibility();
    }
    hideModalSearchResults();
    modalSearchInput.value = '';
    pendingAvatarKey = null;
    const colourDiv = document.querySelector('.modal-colour-avatar');
    if (colourDiv) {
        colourDiv.style.backgroundImage = '';
        colourDiv.style.background = '';
        const textAv = colourDiv.querySelector('.modal-text-avatar');
        if (textAv) textAv.textContent = '';
    }
}

function renderBandList() {
    const bands = [
        { icon: "group.svg", name: "Группа", type: "group" },
        { icon: "channel.svg", name: "Канал", type: "channel" },
        { icon: "search.svg", name: "Найти", type: "search" }
    ]
    bandDropdown.innerHTML = '';
    bands.forEach(band => {
        const option = document.createElement('div');
        option.className = `band-option`;
        option.innerHTML = `
            <img class="band-icon" src="imgs/${band.icon}" alt="${band.name}">
            <span class="band-type">${band.name}</span>
        `;
        option.addEventListener('click', () => {
            selectBand(band);
            closeDropdown();
        });
        bandDropdown.appendChild(option);
    });
}

function closeDropdown() {
    bandDropdown.classList.add('hide');
    setTimeout(() => {
        bandDropdown.classList.remove('show');
    }, 300)
}

function toggleDropdown() {
    if (bandDropdown.classList.contains('show'))
        bandDropdown.classList.add('hide')
    else
        bandDropdown.classList.remove('hide')
    bandDropdown.classList.toggle('show')
}

function selectBand(band) {
    if (band.type === "channel") {
        newChatModal.style.display = 'flex';
        document.querySelector('.modal-title').innerHTML = 'Создание канала';
        document.querySelector('.modal-search-section').style.display = 'none';
        document.querySelector('.modal-selected-participants').style.display = 'none';
        selectedContainer.style.display = 'none';
        channelSettings.style.display = 'flex';
        currentChatType = 'channel';
        createButton.disabled = false;
        updateSlugVisibility();
        resetModal();
        modalSearchInput.focus();
    } else if (band.type === "group") {
        newChatModal.style.display = 'flex';
        document.querySelector('.modal-title').innerHTML = 'Создание группы';
        document.querySelector('.modal-search-section').style.display = 'block';
        selectedContainer.style.display = 'flex';
        channelSettings.style.display = 'none';
        currentChatType = 'group';
        updateCreateButtonState();
        resetModal();
        modalSearchInput.focus();
    } else {
        document.querySelector('.search-input').focus()
        performSearch('')
    }
}

createButton.addEventListener('click', async () => {
    const title = chatTitleInput.value.trim() || null;
    const description = chatDescriptionInput.value || null;
    const participants = Array.from(selectedParticipants.values()).map(u => u.id);

    const body = {
        type: currentChatType,
        title: title === null ? 'Группа ' + name : title,
        description: description,
        participants: participants
    };

    if (currentChatType === 'channel') {
        body.is_private = isPrivateCheckbox.checked;
        if (!body.is_private) {
            body.slug = slugInput.value.trim();
            if (!body.slug) {
                slugError.textContent = 'Имя ссылки обязательно'
                return;
            }
        }
    }

    if (pendingAvatarKey) {
        body.avatar_key = pendingAvatarKey;
    }

    try {
        const createBand = (await apiRequest(createBandPHP, body))['data']
        if (createBand.success) {
            newChatModal.style.display = 'none';
            resetModal();

            const chat = {accountId: -1, chatId: +createBand.chat_id, name: title, online: false, url: createBand.avatar_url, lastMessage: '', sentAt: ['', ''], type: currentChatType}
            chats.unshift(chat)
            addChat(chat)
            const chatsList = document.getElementById('chatsList')
            chatsList.insertBefore(chatsList.lastElementChild, chatsList.firstElementChild)
            chatsList.lastElementChild.remove()
        } else {
            console.error('Ошибка: ' + (createBand.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка создания чата:', error);
    }
});

function updateSlugVisibility() {
    const isPrivate = isPrivateCheckbox.checked;
    slugInput.closest('.slug-row').style.display = isPrivate ? 'none' : 'block';
    if (isPrivate) {
        slugInput.value = '';
        createButton.disabled = false;
    } else {
        slugOnInput()
    }
}

let slugDebounce;
function slugOnInput() {
    document.querySelector('.slug-hint').textContent = 'mint.cloudpub.ru/channel/' + slugInput.value

    clearTimeout(slugDebounce);
    slugDebounce = setTimeout(async () => {
        const slug = slugInput.value.trim();
        if (!slug) {
            createButton.disabled = true;
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(slug)) {
            slugError.textContent = 'Только латиница, цифры и нижнее подчеривание';
            createButton.disabled = true;
            return;
        }
        if (slug.length < 3) {
            slugError.textContent = 'Длина не меньше 3 символов';
            createButton.disabled = true;
            return;
        }
        try {
            const checkSlug = (await apiRequest(`${checkSlugPHP}?slug=${encodeURIComponent(slug)}`))['data']
            if (!checkSlug.available) {
                slugError.textContent = 'Это имя уже занято';
                createButton.disabled = true;
                return;
            }
        } catch (e) {
            console.error('Не смог проверить slug:', e)
        }

        if (document.querySelector('.chat-title-input').value.trim().length < 1) {
            slugError.textContent = 'Название канала обязательно';
            return
        }

        slugError.textContent = '';
        createButton.disabled = false;
    }, 300);
}

let nameDebounce
function nameOnInput() {
    clearTimeout(nameDebounce);
    nameDebounce = setTimeout(async () => {
        if (document.querySelector('.chat-title-input').value.trim().length < 1) {
            slugError.textContent = 'Название канала обязательно';
            return
        }

        slugError.textContent = '';
        createButton.disabled = false;
    }, 300);
}

document.addEventListener('DOMContentLoaded', () => {
    renderBandList
    isPrivateCheckbox.addEventListener('change', updateSlugVisibility);
    slugInput.addEventListener('input', slugOnInput);
    document.querySelector('.chat-title-input').addEventListener('input', nameOnInput);
});