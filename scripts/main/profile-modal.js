import { apiRequest } from '/scripts/api-client.js'
import { openedChat } from "/scripts/main/main.js";

export { openAccountModal }

const profileModal = document.querySelector('.profile-modal');
const profileBg = document.querySelector('.profile-modal-background');
const profileContent = document.querySelector('.profile-modal-content');
const profileCross = document.querySelector('.profile-modal-cross');

profileBg.addEventListener('click', closeAccountModal);
profileCross.addEventListener('click', closeAccountModal);
profileContent.addEventListener('click', (e) => e.stopPropagation());

document.querySelector('.settings-button').addEventListener('click', () => {
    openAccountModal();
});

async function openAccountModal() {
    if (openedChat === -1) return;
    const currentChat = chats.find(c => c.chatId === openedChat);
    if (!currentChat || currentChat.type !== 'personal' || currentChat.type === 'saved') return;
    const id = +document.querySelector('.header-avatar').dataset.accountId

    profileModal.style.display = 'flex';
    try {
        const accountProfile = (await apiRequest(`${getProfilePHP}?user_id=${id}`))['data']
        if (!accountProfile.success) {
            console.error('Ошибка загрузки профиля:', accountProfile.error);
            closeAccountModal();
            return;
        }
        populateSettings(accountProfile);
    } catch (err) {
        console.error('Ошибка запроса профиля:', err);
        closeAccountModal();
    }
}

function closeAccountModal() {
    profileModal.classList.add('closing')
    setTimeout(() => {
        profileModal.style.display = 'none';
        profileModal.classList.remove('closing')
    }, 300)
}

function getAvatarUrl(url) {
    if (!url) return '';
    if (url.startsWith('--')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (window.Capacitor?.isNativePlatform?.()) {
        return baseUrl + (url.startsWith('/') ? url : '/' + url);
    }
    return url;
}

function populateSettings(data) {
    const avatarDiv = document.querySelector('.profile-modal-avatar-img');
    const nameDisplay = document.getElementById('profile-name-display');
    const descDisplay = document.getElementById('profile-description-display');
    const usernameDisplay = document.getElementById('profile-username-display');

    const gradColours = [
        '--avatar-gradient-gray',
        '--avatar-gradient-blue',
        '--avatar-gradient-green',
        '--avatar-gradient-purple',
    ];
    if (gradColours.includes(data.avatar_url)) {
        avatarDiv.style.background = `var(${data.avatar_url})`;
        avatarDiv.textContent = (data.name || '?')[0].toUpperCase();
    } else {
        avatarDiv.style.background = `url('${getAvatarUrl(data.avatar_url)}') center/cover`;
        avatarDiv.textContent = '';
    }

    // Ава
    const avatarContainer = document.querySelector('.settings-modal-avatar');

    // Имя
    nameDisplay.textContent = data.name || 'Без имени';

    // Описание
    descDisplay.innerHTML = data.description || '<i>Описание</i>';
    descDisplay.style.display = 'block';

    // Имя пользователя (username)
    usernameDisplay.textContent = '@' + data.username;
}