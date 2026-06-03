import { apiRequest } from '/scripts/api-client.js'
import { tokenManager } from '/scripts/token-manager.js'
import { showAuthScreen } from "/scripts/spa-router.js";

document.addEventListener('DOMContentLoaded', () => {
    const settingsModal = document.querySelector('.settings-modal');
    const settingsBg = document.querySelector('.settings-modal-background');
    const settingsContent = document.querySelector('.settings-modal-content');
    const settingsCross = document.querySelector('.settings-modal-cross');
    const settingsLeave = document.querySelector('.settings-modal-leave-btn')

    settingsLeave.addEventListener('click', leaveAccount);
    settingsBg.addEventListener('click', closeSettingsModal);
    settingsCross.addEventListener('click', closeSettingsModal);
    settingsContent.addEventListener('click', (e) => e.stopPropagation());

    document.querySelector('.settings-button').addEventListener('click', () => {
        openSettingsModal();
    });

    async function openSettingsModal() {
        settingsModal.style.display = 'flex';
        try {
            const getProfile = (await apiRequest(getProfilePHP))['data']
            if (!getProfile.success) {
                console.error('Ошибка загрузки профиля:', getProfile.error);
                closeSettingsModal();
                return;
            }
            populateSettings(getProfile);
        } catch (err) {
            console.error('Ошибка запроса профиля:', err);
            closeSettingsModal();
        }
    }

    function isNativePlatform() {
        return !!(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.());
    }

    async function leaveAccount() {
        const ok = await tokenManager.logout(false); // true = все устройства
        if (ok) {
            showAuthScreen()
        }
    }

    function closeSettingsModal() {
        settingsModal.classList.add('closing')
        setTimeout(() => {
            settingsModal.style.display = 'none';
            settingsModal.classList.remove('closing')
        }, 300)
        const editName = document.getElementById('settings-name-edit');
        const editDesc = document.getElementById('settings-description-edit');
        const editUsername = document.getElementById('settings-username-edit');
        editName.style.display = 'none';
        editDesc.style.display = 'none';
        editUsername.style.display = 'none';
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
        const avatarDiv = document.querySelector('.settings-modal-avatar-img');
        const nameDisplay = document.getElementById('settings-name-display');
        const descDisplay = document.getElementById('settings-description-display');
        const usernameDisplay = document.getElementById('settings-username-display');

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
        avatarContainer.style.cursor = 'pointer';
        avatarContainer.onclick = () => uploadSettingsAvatar();

        // Имя
        nameDisplay.textContent = data.name || 'Без имени';
        nameDisplay.onclick = () => startEditName(data.name);
        nameDisplay.style.cursor = 'pointer';

        // Описание
        descDisplay.innerHTML = data.description || '<i>Описание</i>';
        descDisplay.style.display = 'block';
        descDisplay.onclick = () => startEditDesc(data.description);
        descDisplay.style.cursor = 'pointer';

        // Имя пользователя (username)
        usernameDisplay.textContent = '@' + data.username;
        usernameDisplay.onclick = () => startEditUsername(data.username);
        usernameDisplay.style.cursor = 'pointer';

        document.getElementById('settings-name-edit').style.display = 'none';
        document.getElementById('settings-description-edit').style.display = 'none';
        document.getElementById('settings-username-edit').style.display = 'none';
        document.getElementById('settings-error').style.display = 'none';
    }

    function startEditName(currentName) {
        const nameDisplay = document.getElementById('settings-name-display');
        const editInput = document.getElementById('settings-name-edit');
        nameDisplay.style.display = 'none';
        editInput.style.display = 'block';
        editInput.value = currentName;
        editInput.focus();

        function finishEdit() {
            const newName = editInput.value.trim();
            editInput.style.display = 'none';
            nameDisplay.style.display = 'block';
            if (newName && newName !== currentName) {
                saveProfileField('name', newName).then(success => {
                    if (success) {
                        nameDisplay.textContent = newName;
                        if (typeof window.name !== 'undefined') window.name = newName;
                    } else {
                        nameDisplay.textContent = currentName;
                    }
                }).catch(() => {
                    nameDisplay.textContent = currentName;
                });
            } else {
                nameDisplay.textContent = currentName;
            }
            editInput.removeEventListener('blur', finishEdit);
            editInput.removeEventListener('keydown', onKeyDown);
        }

        function onKeyDown(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishEdit();
            } else if (e.key === 'Escape') {
                editInput.value = currentName;
                finishEdit();
            }
        }

        editInput.addEventListener('blur', finishEdit);
        editInput.addEventListener('keydown', onKeyDown);
    }

    function startEditDesc(currentDesc) {
        const descDisplay = document.getElementById('settings-description-display');
        const editTextarea = document.getElementById('settings-description-edit');
        descDisplay.style.display = 'none';
        editTextarea.style.display = 'block';
        editTextarea.value = currentDesc === 'Описание' ? '' : currentDesc;
        editTextarea.focus();

        function finishEdit() {
            const newDesc = editTextarea.value.trim();
            editTextarea.style.display = 'none';
            descDisplay.style.display = 'block';
            if (newDesc !== (currentDesc || '')) {
                saveProfileField('description', newDesc).then(success => {
                    if (success) {
                        descDisplay.innerHTML = newDesc === '' ? '<i>Описание</i>' : newDesc;
                    } else {
                        descDisplay.innerHTML = currentDesc === '' ? '<i>Описание</i>' : currentDesc;
                    }
                }).catch(() => {
                    descDisplay.innerHTML = currentDesc === '' ? '<i>Описание</i>' : currentDesc;
                });
            } else {
                descDisplay.innerHTML = currentDesc === '' ? '<i>Описание</i>' : currentDesc;
            }
            editTextarea.removeEventListener('blur', finishEdit);
            editTextarea.removeEventListener('keydown', onKeyDown);
        }

        function onKeyDown(e) {
            if (e.key === 'Escape') {
                editTextarea.value = currentDesc || '';
                finishEdit();
            }
        }

        editTextarea.addEventListener('blur', finishEdit);
        editTextarea.addEventListener('keydown', onKeyDown);
    }

    function startEditUsername(currentUsername) {
        const usernameDisplay = document.getElementById('settings-username-display');
        const editInput = document.getElementById('settings-username-edit');
        const errorDiv = document.getElementById('settings-error');
        usernameDisplay.style.display = 'none';
        editInput.style.display = 'block';
        editInput.value = currentUsername;
        editInput.focus();
        errorDiv.style.display = 'none';

        let originalUsername = currentUsername;

        async function finishEdit() {
            const newUsername = editInput.value.trim();
            if (!newUsername || newUsername === originalUsername) {
                editInput.style.display = 'none';
                usernameDisplay.style.display = 'block';
                usernameDisplay.textContent = '@' + originalUsername;
                errorDiv.style.display = 'none';
                cleanup();
                return;
            }

            if (!/^[a-zA-Z0-9_]{3,35}$/.test(newUsername)) {
                showError('Только латиница, цифры и _ (3-35 символов)');
                return;
            }

            const available = await checkUsernameAvailable(newUsername);
            if (!available) {
                showError('Это имя занято');
                return;
            }

            const success = await saveProfileField('username', newUsername);
            if (success) {
                editInput.style.display = 'none';
                usernameDisplay.style.display = 'block';
                usernameDisplay.textContent = '@' + newUsername;
                errorDiv.style.display = 'none';
                cleanup();
            } else {
                showError('Ошибка сохранения');
            }
        }

        function onKeyDown(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishEdit();
            } else if (e.key === 'Escape') {
                editInput.value = originalUsername;
                finishEdit();
            }
        }

        function cleanup() {
            editInput.removeEventListener('blur', onBlur);
            editInput.removeEventListener('keydown', onKeyDown);
        }

        function onBlur() { finishEdit(); }

        editInput.addEventListener('blur', onBlur);
        editInput.addEventListener('keydown', onKeyDown);

        function showError(msg) {
            errorDiv.textContent = msg;
            errorDiv.style.display = 'block';
        }
    }

    async function uploadFileWithAuth(url, formData) {
    const native = isNativePlatform();
    let accessToken = native ? await tokenManager.getAccessToken() : null;

    const makeRequest = async (token) => {
        const headers = {};
        if (native && token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const fetchOptions = {
            method: 'POST',
            headers: headers,
            body: formData
        };
        if (!native) {
            fetchOptions.credentials = 'include';
        }
        const response = await fetch(url, fetchOptions);
        let data = {};
        try {
            const text = await response.text();
            data = JSON.parse(text);
        } catch (e) {
            // Если ответ не JSON, оставляем пустой объект
        }
        return { response, data };
    };

    let { response, data } = await makeRequest(accessToken);

    // Если сервер вернул ошибку авторизации — пробуем обновить токены через apiRequest
    const needAuth = data && (data.reason === 'invalid_token' || data.authenticated === false);
    if (needAuth) {
        try {
            // Вызов любого легковесного эндпоинта для принудительного обновления токенов
            await apiRequest(window.isLoggedPHP || '/ajax/isLogged.php', {});
        } catch (refreshErr) {
            throw refreshErr;
        }
        if (native) {
            accessToken = await tokenManager.getAccessToken();
        }
        const retry = await makeRequest(accessToken);
        response = retry.response;
        data = retry.data;
    }

    if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
    }
    return data;
}

    async function uploadSettingsAvatar() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        fileInput.click();

        fileInput.addEventListener('change', async function () {
            if (fileInput.files.length === 0) { document.body.removeChild(fileInput); return; }
            const file = fileInput.files[0];
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('compress', '0');

                const uploadData = await uploadFileWithAuth(uploadPHP, formData);
                if (!uploadData.success) {
                    console.error('Ошибка загрузки картинки аватарки');
                    return;
                }

                const fileId = uploadData.file_id;
                const updateResult = await apiRequest(updateProfilePHP, { avatar_file_id: fileId });
                const updateProfile = updateResult.data;

                if (updateProfile.success && updateProfile.avatar_url) {
                    const avatarDiv = document.querySelector('.settings-modal-avatar-img');
                    avatarDiv.style.background = `url('${getAvatarUrl(updateProfile.avatar_url)}') center/cover`;
                    avatarDiv.textContent = '';
                } else {
                    console.error('Ошибка обновления аватара:', updateProfile.error);
                }
            } catch (err) {
                console.error('Ошибка при смене аватара:', err);
            } finally {
                document.body.removeChild(fileInput);
            }
        });
    }

    async function checkUsernameAvailable(username) {
        try {
            const checkUsername = (await apiRequest(`${checkUsernamePHP}?username=${encodeURIComponent(username)}`))['data']
            return checkUsername.available === true;
        } catch {
            return false;
        }
    }

    async function saveProfileField(field, value) {
        try {
            const body = { [field]: value };
            const updateProfile = (await apiRequest(updateProfilePHP), JSON.stringify(body))['data']
            return updateProfile.success === true;
        } catch (e) {
            console.error('Ошибка при сохранении поля:', e);
            return false;
        }
    }
});