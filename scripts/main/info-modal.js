import { apiRequest } from '/scripts/api-client.js';
import { openedChat, escapeHtml, linkifyUrls, changeOpenedChat } from '/scripts/main/main.js';
import { openAccountModal } from '/scripts/main/profile-modal.js'

document.addEventListener('DOMContentLoaded', () => {
    window._chatInfoData = null

    const chatInfoModal = document.querySelector('.chat-info-modal');
    const chatInfoModalBackground = document.querySelector('.chat-info-modal-background');
    const chatInfoModalCross = document.querySelector('.chat-info-modal-cross');
    const chatInfoModalContent = document.querySelector('.chat-info-modal-content');

    chatInfoModalBackground.addEventListener('click', closeChatInfoModal);
    chatInfoModalCross.addEventListener('click', closeChatInfoModal);
    chatInfoModalContent.addEventListener('click', (e) => e.stopPropagation());

    function getAvatarUrl(url) {
        if (!url) return '';
        if (url.startsWith('--')) return url;
        if (url.startsWith('http://') || url.startsWith('https://')) return url;
        if (window.Capacitor?.isNativePlatform?.()) {
            return baseUrl + (url.startsWith('/') ? url : '/' + url);
        }
        return url;
    }

    async function openChatInfoModal() {
        if (openedChat === -1) return;
        const currentChat = chats.find(c => c.chatId === openedChat);
        if (!currentChat || currentChat.type === 'personal') return;

        chatInfoModal.style.display = 'flex';

        const chatInfo = (await apiRequest(`${chatInfoPHP}?chat_id=${openedChat}`))['data']

        if (!chatInfo.success) {
            console.error('Ошибка загрузки информации о чате');
            closeChatInfoModal();
            return;
        }

        const avatarContainer = document.querySelector('.chat-info-modal-avatar');
        if (chatInfo['can_edit'] && avatarContainer) {
            avatarContainer.style.cursor = 'pointer';
            avatarContainer.addEventListener('click', function (e) {
                e.stopPropagation();
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.style.display = 'none';
                document.body.appendChild(fileInput);
                fileInput.click();

                fileInput.addEventListener('change', async function () {
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

                        if (!upload.success) {
                            console.error('Ошибка загрузки файла:', uploadData.error);
                            return;
                        }

                        const avatarFileId = upload.file_id;

                        const updateChat = (await apiRequest(updateChatPHP, { chat_id: openedChat, avatar_file_id: avatarFileId }))['data']

                        if (updateChat.success) {
                            const avatarDiv = avatarContainer.querySelector('.chat-info-modal-avatar-img');
                            const avatarUrl = getAvatarUrl(updateChat.avatar_url);
                            avatarDiv.style.background = `url('${avatarUrl}') center/cover`;
                            avatarDiv.textContent = '';

                            const headerAvatar = document.querySelector('.header-avatar');
                            if (headerAvatar) {
                                const headerImg = headerAvatar.querySelector('.header-avatar-img');
                                if (headerImg) {
                                    headerImg.style.background = `url('${avatarUrl}') center/cover`;
                                    headerImg.textContent = '';
                                } else {
                                    headerAvatar.style.background = `url('${avatarUrl}') center/cover`;
                                    headerAvatar.textContent = '';
                                }
                            }

                            const chatItem = document.querySelector(`.chat-item[data-chat-id="${openedChat}"]`);
                            if (chatItem) {
                                const chatAv = chatItem.querySelector('.chat-avatar');
                                if (chatAv) {
                                    chatAv.style.background = `url('${avatarUrl}') center/cover`;
                                    chatAv.textContent = '';
                                }
                            }

                            const idx = chats.findIndex(c => c.chatId === openedChat);
                            if (idx !== -1) {
                                chats[idx].url = avatarUrl;
                            }
                        } else {
                            console.error('Ошибка обновления аватара:', updateChat.error);
                        }
                    } catch (err) {
                        console.error('Ошибка загрузки аватара:', err);
                    } finally {
                        document.body.removeChild(fileInput);
                    }
                })
            })
        }

        window._chatInfoData = chatInfo

        const chat = chatInfo.chat;
        const participants = chatInfo.participants;

        const avatarDiv = chatInfoModal.querySelector('.chat-info-modal-avatar-img');
        const colours = [
            '--avatar-gradient-gray',
            '--avatar-gradient-blue',
            '--avatar-gradient-green',
            '--avatar-gradient-purple',
        ];
        if (chat.avatar && colours.includes(chat.avatar)) {
            avatarDiv.style.background = `var(${chat.avatar})`;
            avatarDiv.textContent = (chat.title || '?')[0].toUpperCase();
        } else if (chat.avatar) {
            avatarDiv.style.background = `url('${getAvatarUrl(chat.avatar)}') center/cover`;
            avatarDiv.textContent = '';
        } else {
            avatarDiv.style.background = `var(--avatar-gradient-gray)`;
            avatarDiv.textContent = (chat.title || '?')[0].toUpperCase();
        }

        const titleDiv = document.getElementById('chat-info-title');
        titleDiv.textContent = chat.title || 'Без названия';
        const descDiv = document.getElementById('chat-info-desc');
        let escapedContent = escapeHtml(chat.description).replace(/\n/g, '<br>') || ''
        const linkedContent = linkifyUrls(escapedContent);
        descDiv.innerHTML = linkedContent
        descDiv.style.display = chat.description ? 'block' : 'none';

        const editTitle = document.querySelector('.chat-info-edit-title');
        const editDesc = document.querySelector('.chat-info-edit-desc');
        editTitle.style.display = 'none';
        editDesc.style.display = 'none';
        titleDiv.style.display = 'block';
        descDiv.style.display = chat.description ? 'block' : 'none';

        if (chatInfo.can_edit) {
            titleDiv.onclick = () => startEditTitle(chat.title);
            descDiv.onclick = () => startEditDesc(chat.description);
            titleDiv.style.cursor = 'pointer';
            descDiv.style.cursor = 'pointer';
        } else {
            titleDiv.onclick = null;
            descDiv.onclick = null;
            titleDiv.style.cursor = 'default';
            descDiv.style.cursor = 'default';
        }

        const participantsList = document.querySelector('.chat-info-modal-participants-list');
        participantsList.innerHTML = '';
        const participantsTitle = document.querySelector('.chat-info-modal-participants-title');
        if (participants.length > 0) {
            participantsTitle.style.display = 'block';
            participants.forEach(p => {
                const div = document.createElement('div');
                div.className = 'chat-info-modal-participant';
                div.innerHTML = `
                <div class="chat-info-modal-participant-avatar" style="
                    ${colours.includes(p.avatar_url) ? `background: var(${p.avatar_url})` : `background-image: url('${getAvatarUrl(p.avatar_url)}')`};
                ">
                    ${colours.includes(p.avatar_url) ? (p.name[0]?.toUpperCase() || '') : ''}
                </div>
                <span class="chat-info-modal-participant-name">${p.name}</span>
                ${p.role !== 'member' ? `<span class="chat-info-modal-participant-role">${p.role === 'owner' ? 'Владелец' : 'Админ'}</span>` : ''}
                ${p.can_remove ? `<button class="chat-info-modal-participant-remove" data-user-id="${p.id}" title="Исключить">✕</button>` : ''}
            `;
                participantsList.appendChild(div);
            });

            participantsList.querySelectorAll('.chat-info-modal-participant-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const targetId = btn.dataset.userId;
                    removeParticipant(openedChat, targetId);
                });
            });
        } else {
            participantsTitle.style.display = 'none';
        }

        const inviteBtn = document.querySelector('.chat-info-modal-invite-btn');
        inviteBtn.onclick = () => getInviteLinkForChat(openedChat);
    }

    function closeChatInfoModal() {
        chatInfoModal.classList.add('closing');
        setTimeout(() => {
            chatInfoModal.classList.remove('closing');
            chatInfoModal.style.display = 'none';
        }, 300)
        window._chatInfoData = null;
    }

    async function getInviteLinkForChat(chatId) {
        try {
            const getChatInviteLink = (await apiRequest(getChatInviteLinkPHP, { chat_id: chatId }))['data']
            if (getChatInviteLink.success && getChatInviteLink.url) {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(getChatInviteLink.url);
                    document.querySelector('.chat-info-modal-invite-btn').innerText = 'Скопировано'
                    setTimeout(() => {
                        document.querySelector('.chat-info-modal-invite-btn').innerText = 'Получить ссылку приглашения'
                    }, 1000)
                } else {
                    prompt('Ссылка (скопируйте вручную):', getChatInviteLink.url);
                }
            } else {
                console.error('Не удалось получить ссылку: ' + (getChatInviteLink.error || 'ошибка'));
            }
        } catch (e) {
            console.error('Ошибка получения ссылки:', e);
        }
    }

    function startEditTitle(currentTitle) {
        const titleDiv = document.getElementById('chat-info-title');
        const editTitle = document.querySelector('.chat-info-edit-title');
        titleDiv.style.display = 'none';
        editTitle.style.display = 'block';
        editTitle.value = currentTitle;
        editTitle.focus();

        async function finishEdit() {
            const newTitle = editTitle.value.trim();
            editTitle.style.display = 'none';
            titleDiv.style.display = 'block';
            if (newTitle && newTitle !== currentTitle) {
                const updateChat = (await apiRequest(updateChatPHP, { chat_id: openedChat, title: newTitle }))['data']
                if (updateChat.success) {
                    titleDiv.textContent = newTitle;
                    if (window._chatInfoData) window._chatInfoData.chat.title = newTitle;
                    updateChatTitleInUI(newTitle);
                } else {
                    titleDiv.textContent = currentTitle;
                }
            } else {
                titleDiv.textContent = currentTitle;
            }
            editTitle.removeEventListener('blur', finishEdit);
            editTitle.removeEventListener('keydown', onKeyDown);
        }

        function onKeyDown(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishEdit();
            } else if (e.key === 'Escape') {
                editTitle.value = currentTitle;
                finishEdit();
            }
        }

        editTitle.addEventListener('blur', finishEdit);
        editTitle.addEventListener('keydown', onKeyDown);
    }

    function startEditDesc(currentDesc) {
        const descDiv = document.getElementById('chat-info-desc');
        const editDesc = document.querySelector('.chat-info-edit-desc');
        descDiv.style.display = 'none';
        editDesc.style.display = 'block';
        editDesc.value = currentDesc || '';
        editDesc.focus();

        async function finishEdit() {
            const newDesc = editDesc.value.trim();
            editDesc.style.display = 'none';
            descDiv.style.display = newDesc ? 'block' : 'none';
            if (newDesc !== (currentDesc || '')) {
                const updateChat = (await apiRequest(updateChatPHP, { chat_id: openedChat, description: newDesc }))['data']
                if (updateChat.success) {
                    descDiv.textContent = newDesc;
                    if (window._chatInfoData) window._chatInfoData.chat.description = newDesc;
                } else {
                    descDiv.textContent = currentDesc || '';
                }
            } else {
                descDiv.textContent = currentDesc || '';
            }
            editDesc.removeEventListener('blur', finishEdit);
            editDesc.removeEventListener('keydown', onKeyDown);
        }

        function onKeyDown(e) {
            if (e.key === 'Escape') {
                editDesc.value = currentDesc || '';
                finishEdit();
            }
        }

        editDesc.addEventListener('blur', finishEdit);
        editDesc.addEventListener('keydown', onKeyDown);
    }

    async function removeParticipant(chatId, targetId) {
        try {
            const removeParticipant = (await apiRequest(removeParticipantPHP, { chat_id: chatId, target_id: targetId }))['data']
            if (removeParticipant.success) {
                openChatInfoModal();
            } else {
                console.error(removeParticipant.error);
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function leaveChat() {
        try {
            const leaveChat = (await apiRequest(leaveChatPHP, { chat_id: openedChat }))['data']
            if (leaveChat.success) {
                closeChatInfoModal();
                const idx = chats.findIndex(c => c.chatId === openedChat);
                if (idx !== -1) chats.splice(idx, 1);
                document.querySelector(`.chat-item[data-chat-id="${openedChat}"]`).remove();

                const nextChat = chats[0];
                if (nextChat) {
                    document.querySelector(`.chat-item[data-chat-id="${nextChat.chatId}"]`).click();
                } else {
                    changeOpenedChat(-1)
                    document.getElementById('messagesList').innerHTML = '';
                    document.querySelector('.header-name').textContent = '';
                    document.querySelector('.header-avatar').innerHTML = '';
                    document.querySelector('.messages-bottom').style.display = 'none';
                    document.querySelector('.messages-header').style.display = 'none';
                }
            } else {
                console.error(leaveChat.error || 'Ошибка выхода');
            }
        } catch (e) {
            console.error(e);
        }
    }

    document.querySelector('.chat-info-modal-leave-btn').addEventListener('click', leaveChat);
    document.querySelector('.header-leave-btn').addEventListener('click', leaveChat);

    function updateChatTitleInUI(newTitle) {
        document.querySelector('.header-name').textContent = newTitle;
        const chatItem = document.querySelector(`.chat-item[data-chat-id="${openedChat}"]`);
        if (chatItem) {
            const nameDiv = chatItem.querySelector('.chat-name');
            if (nameDiv) nameDiv.textContent = newTitle;
        }
        const chatIdx = chats.findIndex(c => c.chatId === openedChat);
        if (chatIdx !== -1) chats[chatIdx].name = newTitle;
    }

    document.querySelector('.header-info').addEventListener('click', (e) => {
        if (e.target.closest('.header-calls') || e.target.closest('button')) return;
        openChatInfoModal();
        openAccountModal();
    });
})