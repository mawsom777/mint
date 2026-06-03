import { apiRequest } from "/scripts/api-client.js";
import { WebRTCClient, webrtcClient, changeCamera } from "/scripts/main/webrtc-client.js";
import { generateAvatar } from "/scripts/main/main.js";
import { displayIncomingCall, isDisplaying } from '/scripts/main/capacitor-call-android.js'

export { handleIncomingCall }


function isNativePlatform() {
    return !!(typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.());
}

class CallManager extends WebRTCClient {
    constructor() {
        super();

        this.callModal = document.getElementById('callModal');
        this.acceptBtn = document.getElementById('acceptCallBtn');
        this.rejectBtn = document.getElementById('rejectCallBtn');
        this.endBtn = document.getElementById('endCallBtn');
        this.toggleMicBtn = document.getElementById('toggleMicBtn');
        this.toggleCameraBtn = document.getElementById('toggleCameraBtn');
        this.switchCameraBtn = document.getElementById('switchCameraBtn');
        this.callStatus = document.getElementById('callStatus');
        this.callInfo = document.getElementById('callInfo');
        this.callAvatar = document.getElementById('callAvatar');
        this.isMicEnabled = true;
        this.isCameraEnabled = true;

        this.setupEventListeners();
        webrtcClient.startSignalChecking();
    }

    setupEventListeners() {
        if (this.acceptBtn) {
            this.acceptBtn.addEventListener('click', () => this.acceptIncomingCall());
        }

        if (this.rejectBtn) {
            this.rejectBtn.addEventListener('click', () => this.rejectIncomingCall());
        }

        if (this.endBtn) {
            this.endBtn.addEventListener('click', () => this.endCall());
        }

        if (this.toggleMicBtn) {
            this.toggleMicBtn.addEventListener('click', () => webrtcClient.toggleMicrophone());
        }

        if (this.toggleCameraBtn) {
            this.toggleCameraBtn.addEventListener('click', () => webrtcClient.toggleCamera());
        }

        if (this.switchCameraBtn) {
            this.switchCameraBtn.addEventListener('click', () => webrtcClient.showCameraSelection());
            this.switchCameraBtn.addEventListener('change', () => changeCamera(this.value));
        }
    }

    showCallModal(state, callType) {
        if (!this.callModal) return;

        this.callModal.classList.remove('call-active-video');

        this.callModal.style.display = 'flex';
        this.callModal.classList.toggle('call-type-audio', callType === 'audio');
        this.callModal.classList.toggle('call-type-video', callType === 'video');

        const videoContainer = document.querySelector('.video-container');
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        const avatar = document.getElementById('callAvatar');

        if (videoContainer) videoContainer.style.display = 'none';
        if (avatar) avatar.style.display = 'flex';
        const chat = chats.find(item => item.accountId === Number(webrtcClient.targetUserId));
        const colours = [
            '--avatar-gradient-gray',
            '--avatar-gradient-blue',
            '--avatar-gradient-green',
            '--avatar-gradient-purple',
        ]

        switch(state) {
            case 'outgoing':
                if (colours.includes(chat.url)) {
                    avatar.innerHTML = generateAvatar(chat.name);
                    avatar.style.background = `var(${chat.url})`;
                } else {
                    avatar.style.backgroundImage = `url('${chat.url.replace(/'/g, "\\'")}')`;
                }
                this.callStatus.textContent = `${chat.name}`;
                this.callInfo.textContent = `${callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}`;

                if (callType === 'video') {
                    if (videoContainer) {
                        videoContainer.style.display = 'block';
                        videoContainer.classList.add('outgoing-video');
                    }
                    if (avatar) avatar.style.display = 'none';
                    if (localVideo) {
                        localVideo.style.display = 'block';
                        localVideo.srcObject = webrtcClient.localStream;
                    }
                } else {
                    avatar.classList.add('pulse-animation');
                }

                this.acceptBtn.style.display = 'none';
                this.rejectBtn.style.display = 'none';
                this.endBtn.style.display = 'flex';

                if (videoContainer) {
                    if (callType === 'video') {
                        videoContainer.style.display = 'flex';
                        remoteVideo.style.display = 'none';
                        localVideo.classList.add('in-request')
                        webrtcClient.initializeMedia('video')
                    } else {
                        videoContainer.style.display = 'none';
                    }
                }
                break;

            case 'incoming':
                if (isNativePlatform() && !isDisplaying)
                    displayIncomingCall()

                if (colours.includes(chat.url)) {
                    avatar.innerHTML = generateAvatar(chat.name);
                    avatar.style.background = `var(${chat.url})`;
                } else {
                    avatar.style.backgroundImage = `url('${chat.url.replace(/'/g, "\\'")}')`;
                }

                this.callStatus.textContent = `${chat.name}`;
                this.callInfo.textContent = `${callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}`;
                this.acceptBtn.style.display = 'flex';
                this.rejectBtn.style.display = 'flex';
                this.endBtn.style.display = 'none';
                break;

            case 'active':
                if (videoContainer) {
                    if (callType === 'video') {
                        videoContainer.style.display = 'block';
                        remoteVideo.style.display = 'block';
                    }
                }

                localVideo.classList.remove('in-request')
                if (avatar) avatar.style.display = 'none';
                avatar.classList.remove('pulse-animation');
                this.acceptBtn.style.display = 'none';
                this.rejectBtn.style.display = 'none';
                this.endBtn.style.display = 'flex';
                break;
        }

        if (state === 'active' && callType === 'video') {
            this.callModal.classList.add('call-active-video');
            const mediaControls = document.querySelector('.media-controls');
            if (mediaControls) {
                mediaControls.style.display = 'flex';
            }
        } else {
            const mediaControls = document.querySelector('.media-controls');
            mediaControls.style.display = 'none';
        }

    }

    hideCallModal() {
        if (this.callModal) {
            this.callModal.classList.remove('call-active-video');
            this.callModal.style.display = 'none';
        }
    }

    async handleIncomingCall(caller, type) {
        webrtcClient.targetUserId = caller;
        this.currentCallType = type;

        this.showCallModal('incoming', this.currentCallType);

        if (this.incomingCallTimeout) {
            clearTimeout(this.incomingCallTimeout);
        }

        this.incomingCallTimeout = setTimeout(() => {
            if (this.incomingCallData) {
                console.log('Incoming call timeout, auto rejecting');
                this.rejectIncomingCall();
            }
        }, 30000);
    }

    async acceptIncomingCall() {
        const callAnswer = (await apiRequest(callAnswerPHP, {'accepted': true, 'caller': webrtcClient.targetUserId}))['response']
        if (callAnswer.status === 200) {
            callManager.showCallModal('active', callManager.currentCallType)
            webrtcClient.startCall(webrtcClient.targetUserId, callManager.currentCallType)
        }

        this.showCallModal('active', this.currentCallType)
    }

    async rejectIncomingCall() {
        const callAnswer = (await apiRequest(callAnswerPHP, {'accepted': false, 'caller': webrtcClient.targetUserId}))['response']
        if (callAnswer.status !== 200) {
            console.log("не смог отказаться: ", callAnswer.responseText)
        }

        this.hideCallModal();

        if (this.incomingCallTimeout) {
            clearTimeout(this.incomingCallTimeout);
            this.incomingCallTimeout = null;
        }

        this.incomingCallData = null;
        this.isCalling = false;
        webrtcClient.targetUserId = null;
        this.currentCallType = null;
    }

    async endCall() {
        const endCall = (await apiRequest(endCallPHP, {'caller': webrtcClient.targetUserId}))['response']
        if (endCall.status !== 200) {
            console.log("не смог закончить: : ", endCall.responseText)
        }
        webrtcClient.endCall();
    }

    updateMediaControls() {
        const micBtn = document.getElementById('toggleMicBtn');
        const cameraBtn = document.getElementById('toggleCameraBtn');
        const switchBtn = document.getElementById('switchCameraBtn');

        this.isMicEnabled = webrtcClient.isMicEnabled;
        this.isCameraEnabled = webrtcClient.isCameraEnabled;

        if (micBtn) {
            micBtn.classList.toggle('muted', !this.isMicEnabled);
        }
        if (cameraBtn) {
            cameraBtn.classList.toggle('disabled', !this.isCameraEnabled);
        }
        if (switchBtn) {
            switchBtn.style.display = (webrtcClient.currentCallType === 'video' && this.isCameraEnabled) ? 'flex' : 'none';
        }
    }
}

function handleIncomingCall(caller, type) {
    callManager.handleIncomingCall(caller, type)
}

document.addEventListener('DOMContentLoaded', () => {
    window.callManager = new CallManager();
});