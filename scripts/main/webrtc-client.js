import { apiRequest } from '/scripts/api-client.js';
import { openedChat } from "/scripts/main/main.js";
import { tokenManager } from '/scripts/token-manager.js';

export { WebRTCClient, webrtcClient, changeCamera }

async function sendFormData(url, formData) {
    const isNative = window.Capacitor?.isNativePlatform?.() === true;
    const headers = {};
    if (isNative) {
        const token = await tokenManager.getAccessToken();
        if (token && token !== 'undefined') {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: headers,
        credentials: isNative ? 'omit' : 'include'
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
}

class WebRTCClient {
    constructor() {
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.isCalling = false;
        this.targetUserId = null;
        this.signalCheckInterval = null;
        this.currentCallType = null;

        this.pendingIceCandidates = [];
        this.isRemoteDescriptionSet = false;

        this.availableCameras = [];
        this.currentCameraId = null;
        this.isMicEnabled = true;
        this.isCameraEnabled = true;
        this.callActive = false;
        this.mediaInitialized = false;

        this.rtcConfig = {
            iceServers: audioServers,
            iceCandidatePoolSize: 10
        };
    }

    updateMediaControls(show) {
        const controls = document.getElementById('mediaControls');
        if (controls) {
            controls.style.display = show ? 'block' : 'none';
        }

        if (show) {
            this.updateButtonStates();
        }
    }

    updateButtonStates() {
        const micBtn = document.getElementById('toggleMicBtn');
        const cameraBtn = document.getElementById('toggleCameraBtn');
        const switchBtn = document.getElementById('switchCameraBtn');

        if (micBtn) {
            micBtn.classList.toggle('muted', !this.isMicEnabled);
        }
        if (cameraBtn) {
            cameraBtn.classList.toggle('disabled', !this.isCameraEnabled);
        }
        if (switchBtn) {
            switchBtn.style.display = (this.currentCallType === 'video' && this.isCameraEnabled) ? 'flex' : 'none';
        }
    }

    toggleMicrophone() {
        if (!this.localStream) return;

        const audioTracks = this.localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            this.isMicEnabled = !this.isMicEnabled;
            audioTracks.forEach(track => {
                track.enabled = this.isMicEnabled;
            });
            this.updateButtonStates();
            if (callManager) callManager.updateMediaControls();
        }
    }

    toggleCamera() {
        if (!this.localStream || this.currentCallType === 'audio') return;

        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            this.isCameraEnabled = !this.isCameraEnabled;
            videoTracks.forEach(track => {
                track.enabled = this.isCameraEnabled;
            });

            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.style.display = this.isCameraEnabled ? 'block' : 'none';
            }

            this.updateButtonStates();
            if (callManager) callManager.updateMediaControls();
        }
    }

    async getAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.availableCameras = devices.filter(device => device.kind === 'videoinput');

            const select = document.getElementById('cameraSelect');
            if (select) {
                select.innerHTML = '';
                this.availableCameras.forEach(camera => {
                    const option = document.createElement('option');
                    option.value = camera.deviceId;
                    option.text = camera.label || `Camera ${select.options.length + 1}`;
                    option.selected = camera.deviceId === this.currentCameraId;
                    select.appendChild(option);
                });
            }

            return this.availableCameras;
        } catch (error) {
            console.error('Error getting cameras:', error);
            return [];
        }
    }

    async showCameraSelection() {
        if (this.currentCallType !== 'video' || !this.isCameraEnabled) return;

        await this.getAvailableCameras();
        document.getElementById('cameraSelect').style.display = 'block';
    }

    async switchCamera(deviceId) {
        if (!deviceId || !this.localStream || this.currentCallType !== 'video') return;
        try {
            const constraints = {
                video: { deviceId: { exact: deviceId } },
                audio: false
            };
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            const newVideoTrack = newStream.getVideoTracks()[0];
            if (!newVideoTrack) throw new Error('No video track');

            const oldVideoTrack = this.localStream.getVideoTracks()[0];
            if (oldVideoTrack) {
                this.localStream.removeTrack(oldVideoTrack);
                oldVideoTrack.stop();
            }
            this.localStream.addTrack(newVideoTrack);

            if (this.peerConnection) {
                const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                if (sender) await sender.replaceTrack(newVideoTrack);
            }

            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
                localVideo.play();
            }

            this.currentCameraId = deviceId;
            newStream.getTracks().filter(t => t !== newVideoTrack).forEach(t => t.stop());
        } catch (error) {
            console.error('Switch camera error:', error);
            alert('Не удалось переключить камеру');
        }
    }

    async initializeMedia(callType) {
        if (this.mediaInitialized && this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
            });
            this.localStream = null;
            this.mediaInitialized = false;
        }

        try {
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };

            if (callType === 'video') {
                constraints.video = {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                };
            } else if (callType === 'audio') {
                constraints.video = false;
            }

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.currentCallType = callType;
            this.mediaInitialized = true;

            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                if (callType === 'audio') {
                    localVideo.style.display = 'none';
                } else {
                    localVideo.style.display = 'block';
                    localVideo.srcObject = this.localStream;
                    localVideo.muted = true;
                    localVideo.onloadedmetadata = () => {
                        localVideo.play().catch(e => console.warn('Video play warning:', e));
                    };
                }
            }

            this.isMicEnabled = true;
            this.isCameraEnabled = (callType === 'video');

            return this.localStream;
        } catch (error) {
            this.mediaInitialized = false;
            let errorMessage = 'Cannot access media devices. ';
            if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage += 'No camera or microphone found.';
            } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage += 'Permission denied. Please allow camera and microphone access.';
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMessage += 'Camera or microphone is already in use by another application.';
            } else {
                errorMessage += `Error: ${error.message}`;
            }
            throw new Error(errorMessage);
        }
    }

    createPeerConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
        }

        this.pendingIceCandidates = [];
        this.isRemoteDescriptionSet = false;

        this.peerConnection = new RTCPeerConnection(this.rtcConfig);

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        this.peerConnection.ontrack = (event) => {
            if (!this.remoteStream) {
                this.remoteStream = new MediaStream();
            }
            event.streams[0].getTracks().forEach(track => {
                this.remoteStream.addTrack(track);
            });

            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo) {
                remoteVideo.srcObject = this.remoteStream;
            }
            this.updateCallStatus('', 'status-connected'); // connected
        };

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && webrtcClient.targetUserId) {
                this.sendSignal('candidate', event.candidate);
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            if (state === 'connected') {
                webrtcClient.callActive = true;
                this.updateCallStatus('', 'status-connected'); // call connected! (присоеденились уже прям полностью и все работает)
            } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                if (webrtcClient.callActive) {
                    webrtcClient.endCall();
                }
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            if (this.peerConnection.iceConnectionState === 'failed') {
                console.error('ICE connection failed');
            }
        };
    }

    async startCall(targetUserId, callType = 'video') {
        if (!targetUserId) {
            console.error('Не вижу цель для звонка')
            return;
        }
        webrtcClient.targetUserId = targetUserId

        if (webrtcClient.isCalling) {
            webrtcClient.endCall();
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        try {
            await this.initializeMedia(callType);
        } catch (error) {
            alert(error.message);
            return;
        }

        this.isCalling = true;
        callManager.currentCallType = callType;
        this.createPeerConnection();

        if (!this.peerConnection) {
            console.error('Не смог связаться')
            this.endCall();
            return;
        }

        this.updateCallStatus('', 'status-calling');

        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            await this.sendOfferToServer(offer, callType);

            if (this.signalCheckInterval) {
                clearInterval(this.signalCheckInterval);
            }
            this.startSignalChecking();

            this.callActive = true;
            this.updateMediaControls(true);
        } catch (error) {
            console.error('Error starting call:', error);
            this.endCall();
        }
    }

    async sendOfferToServer(offer, callType) {
        const formData = new FormData();
        formData.append('target_user_id', this.targetUserId);
        formData.append('offer', JSON.stringify(offer));
        formData.append('call_type', callType);

        const data = await sendFormData(callsCallPHP, formData);
        if (!data.success) {
            throw new Error(data.error || 'Failed to initiate call');
        }
    }

    async sendSignal(signalType, signalData) {
        if (!this.targetUserId) return;
        const formData = new FormData();
        formData.append('action', 'send_signal');
        formData.append('to_user_id', this.targetUserId);
        formData.append('signal_type', signalType);
        formData.append('signal_data', JSON.stringify(signalData));
        formData.append('call_type', this.currentCallType);
        try {
            await sendFormData(callsSignalingPHP, formData);
        } catch (error) {
            console.error('Error sending signal:', error);
        }
    }

    async handleOffer(offerData) {
        if (webrtcClient.isCalling) {
            console.warn('Already in a call, ignoring incoming offer');
            return;
        }

        try {
            this.targetUserId = offerData.from_user_id;
            this.isCalling = true;
            this.currentCallType = offerData.call_type || 'video';

            await this.initializeMedia(this.currentCallType);
            this.createPeerConnection();

            const offer = JSON.parse(offerData.signal_data);
            await this.peerConnection.setRemoteDescription(offer);
            this.isRemoteDescriptionSet = true;

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            await this.sendSignal('answer', answer);

            this.processPendingIceCandidates();

            if (this.signalCheckInterval) {
                clearInterval(this.signalCheckInterval);
            }
            this.startSignalChecking();

            this.callActive = true;
            this.updateMediaControls(true);

            this.updateCallStatus(
                ``,  // Incoming ${this.currentCallType} call...
                'status-calling'
            );
        } catch (error) {
            console.error('Error handling offer:', error);
            this.endCall();
        }
    }

    async handleAnswer(answerData) {
        if (!this.peerConnection) return;

        try {
            const answer = JSON.parse(answerData.signal_data);
            await this.peerConnection.setRemoteDescription(answer);
            this.isRemoteDescriptionSet = true;
            this.processPendingIceCandidates();
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleIceCandidate(candidateData) {
        if (!this.peerConnection) return;

        try {
            const candidate = JSON.parse(candidateData.signal_data);
            if (!this.isRemoteDescriptionSet) {
                this.pendingIceCandidates.push(candidateData);
                if (this.pendingIceCandidates.length > 20) {
                    this.pendingIceCandidates.shift();
                }
                return;
            }
            await this.peerConnection.addIceCandidate(candidate);
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    async processPendingIceCandidates() {
        while (this.pendingIceCandidates.length > 0) {
            const candidateData = this.pendingIceCandidates.shift();
            await this.handleIceCandidate(candidateData);
        }
    }

    startSignalChecking() {
        if (this.signalCheckInterval) {
            clearInterval(this.signalCheckInterval);
        }

        this.signalCheckInterval = setInterval(async () => {
            await this.checkForSignals();
        }, 2000);
    }

    async checkForSignals() {
        const formData = new FormData();
        formData.append('action', 'get_signals');
        try {
            const data = await sendFormData(callsSignalingPHP, formData);
            if (data.signals && data.signals.length > 0) {
                for (const signal of data.signals) {
                    switch (signal.signal_type) {
                        case 'offer': await this.handleOffer(signal); break;
                        case 'answer': await this.handleAnswer(signal); break;
                        case 'candidate': await this.handleIceCandidate(signal); break;
                    }
                }
            }
        } catch (error) {
            console.error('Error checking signals:', error);
        }
    }

    endCall() {
        webrtcClient.isCalling = false;
        webrtcClient.callActive = false;
        webrtcClient.targetUserId = null;
        webrtcClient.currentCallType = null;
        webrtcClient.mediaInitialized = false;
        webrtcClient.updateMediaControls(false);

        if (this.signalCheckInterval) {
            clearInterval(this.signalCheckInterval);
            this.signalCheckInterval = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
            });
            this.localStream = null;
        }

        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }

        if (this.peerConnection) {
            this.peerConnection.onicecandidate = null;
            this.peerConnection.ontrack = null;
            this.peerConnection.onconnectionstatechange = null;
            this.peerConnection.oniceconnectionstatechange = null;
            this.peerConnection.onnegotiationneeded = null;

            try {
                this.peerConnection.close();
            } catch (e) {
                console.warn('Error closing peer connection:', e);
            }
            this.peerConnection = null;
        }

        this.pendingIceCandidates = [];
        this.isRemoteDescriptionSet = false;

        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo) {
            remoteVideo.srcObject = null;
            remoteVideo.pause();
        }

        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.srcObject = null;
            localVideo.pause();
            localVideo.style.display = 'none';
        }

        const cameraContainer = document.getElementById('cameraSelectContainer');
        if (cameraContainer) {
            cameraContainer.style.display = 'none';
        }

        this.updateCallStatus('', '');
        callManager.hideCallModal();

        this.startSignalChecking();
    }

    updateCallStatus(message, cssClass) {
        const statusElement = document.getElementById('callStatus');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `call-status ${cssClass}`;
        }
    }
}

const webrtcClient = new WebRTCClient();

async function startVideoCall() {
    const chatElement = document.querySelector(`[data-chat-id="${openedChat}"]`);
    const targetUserId = +chatElement.dataset.accountId

    const callRequest = (await apiRequest(callRequestPHP, {'target': targetUserId, 'type': 'video'}))['response']
    if (callRequest.status !== 200) {
        console.log('video request wasnt sent')
    }
    const sendNotification = (await apiRequest(sendNotificationPHP, {
        recipient_id: targetUserId,
        body: `Видеозвонок`,
        data: { source: 'call' }
    }))['response']

    if (sendNotification.status !== 200)
        console.log(sendNotification.responseText)

    callManager.isCalling = true
    callManager.requestCallType = 'video'
    webrtcClient.targetUserId = targetUserId
    callManager.showCallModal('outgoing', 'video')
}

async function startAudioCall() {
    const chatElement = document.querySelector(`[data-chat-id="${openedChat}"]`);
    const targetUserId = +chatElement.dataset.accountId

    const callRequest = (await apiRequest(callRequestPHP, {'target': targetUserId, 'type': 'audio'}))['response']
    if (callRequest.status !== 200) {
        console.log('audio request wasnt sent')
    }

    const sendNotification = (await apiRequest(sendNotificationPHP, {
        recipient_id: targetUserId,
        body: `Аудиозвонок`,
        data: { source: 'call' }
    }))['response']

    if (sendNotification.status !== 200)
        console.log(sendNotification.responseText)

    callManager.isCalling = true
    callManager.requestCallType = 'audio'
    webrtcClient.targetUserId = targetUserId
    callManager.showCallModal('outgoing', 'audio')
}

function endCall() {
    webrtcClient.endCall();
}

function toggleMicrophone() {
    webrtcClient.toggleMicrophone();
}

function toggleCamera() {
    webrtcClient.toggleCamera();
}

function switchCamera() {
    webrtcClient.showCameraSelection();
}

function changeCamera(deviceId) {
    if (deviceId) {
        webrtcClient.switchCamera(deviceId);
    }
}

const startAudioCallBtn = document.querySelector('.audio-call-header')
startAudioCallBtn.addEventListener('click', startAudioCall);

const startVideoCallBtn = document.querySelector('.video-call-header')
startVideoCallBtn.addEventListener('click', startVideoCall);