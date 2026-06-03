function isNativePlatform() {
    return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
}

const platform = isNativePlatform() ? 'Android' : 'Web'  // 'Android' или 'Web'
window.baseUrl = 'https://mint.cloudpub.ru'

let isLoggedPHP, checkLoginPHP, mainDataPHP, mainChatsPHP,
    saveTokenPHP, checkTokenPHP, callAnswerPHP, endCallPHP,
    uploadPHP, filePHP, searchUsersPHP, createBandPHP,
    checkSlugPHP, chatInfoPHP, updateChatPHP, getChatInviteLinkPHP,
    removeParticipantPHP, leaveChatPHP, beenReadPHP, chatPHP,
    ssePHP, sendMessagePHP, sendNotificationPHP, createInviteLinkPHP,
    readPackagePHP, editMessagePHP, deleteMessagePHP, markOnlinePHP,
    getProfilePHP, updateProfilePHP, checkUsernamePHP, callRequestPHP,
    refreshPHP, logoutPHP, accountProfilePHP, callsCallPHP, callsSignalingPHP

if (platform === 'Web') {
    isLoggedPHP          = '/ajax/isLogged.php'
    checkLoginPHP        = '/ajax/checkLogin.php'
    mainDataPHP          = '/ajax/mainData.php'
    mainChatsPHP         = '/ajax/mainChats.php'
    saveTokenPHP         = '/ajax/saveToken.php'
    checkTokenPHP        = '/ajax/checkToken.php'
    callAnswerPHP        = '/ajax/callAnswer.php'
    endCallPHP           = '/ajax/endCall.php'
    uploadPHP            = '/ajax/upload.php'
    filePHP              = '/ajax/file.php'
    searchUsersPHP       = '/ajax/searchUsers.php'
    createBandPHP        = '/ajax/createBand.php'
    checkSlugPHP         = '/ajax/checkSlug.php'
    chatInfoPHP          = '/ajax/chatInfo.php'
    updateChatPHP        = '/ajax/updateChat.php'
    getChatInviteLinkPHP = '/ajax/getChatInviteLink.php'
    removeParticipantPHP = '/ajax/removeParticipant.php'
    leaveChatPHP         = '/ajax/leaveChat.php'
    beenReadPHP          = '/ajax/beenRead.php'
    chatPHP              = '/ajax/chat.php'
    ssePHP               = '/ajax/SSE.php'
    sendMessagePHP       = '/ajax/sendMessage.php'
    sendNotificationPHP  = '/ajax/sendNotification.php'
    createInviteLinkPHP  = '/ajax/createInviteLink.php'
    readPackagePHP       = '/ajax/readPackage.php'
    editMessagePHP       = '/ajax/editMessage.php'
    deleteMessagePHP     = '/ajax/deleteMessage.php'
    markOnlinePHP        = '/ajax/markOnline.php'
    getProfilePHP        = '/ajax/getProfile.php'
    updateProfilePHP     = '/ajax/updateProfile.php'
    checkUsernamePHP     = '/ajax/checkUsername.php'
    callRequestPHP       = '/ajax/callRequest.php'
    refreshPHP           = '/ajax/refresh.php'
    logoutPHP            = '/ajax/logout.php'
    accountProfilePHP    = '/ajax/accountProfile.php'
    
    callsCallPHP         = '/ajax/call.php'
    callsSignalingPHP    = '/ajax/signaling.php'

} else if (platform === 'Android') {
    isLoggedPHP          = baseUrl + '/ajax/isLogged.php'
    checkLoginPHP        = baseUrl + '/ajax/checkLogin.php'
    mainDataPHP          = baseUrl + '/ajax/mainData.php'
    mainChatsPHP         = baseUrl + '/ajax/mainChats.php'
    saveTokenPHP         = baseUrl + '/ajax/saveToken.php'
    checkTokenPHP        = baseUrl + '/ajax/checkToken.php'
    callAnswerPHP        = baseUrl + '/ajax/callAnswer.php'
    endCallPHP           = baseUrl + '/ajax/endCall.php'
    uploadPHP            = baseUrl + '/ajax/upload.php'
    filePHP              = baseUrl + '/ajax/file.php'
    searchUsersPHP       = baseUrl + '/ajax/searchUsers.php'
    createBandPHP        = baseUrl + '/ajax/createBand.php'
    checkSlugPHP         = baseUrl + '/ajax/checkSlug.php'
    chatInfoPHP          = baseUrl + '/ajax/chatInfo.php'
    updateChatPHP        = baseUrl + '/ajax/updateChat.php'
    getChatInviteLinkPHP = baseUrl + '/ajax/getChatInviteLink.php'
    removeParticipantPHP = baseUrl + '/ajax/removeParticipant.php'
    leaveChatPHP         = baseUrl + '/ajax/leaveChat.php'
    beenReadPHP          = baseUrl + '/ajax/beenRead.php'
    chatPHP              = baseUrl + '/ajax/chat.php'
    ssePHP               = baseUrl + '/ajax/SSE.php'
    sendMessagePHP       = baseUrl + '/ajax/sendMessage.php'
    sendNotificationPHP  = baseUrl + '/ajax/sendNotification.php'
    createInviteLinkPHP  = baseUrl + '/ajax/createInviteLink.php'
    readPackagePHP       = baseUrl + '/ajax/readPackage.php'
    editMessagePHP       = baseUrl + '/ajax/editMessage.php'
    deleteMessagePHP     = baseUrl + '/ajax/deleteMessage.php'
    markOnlinePHP        = baseUrl + '/ajax/markOnline.php'
    getProfilePHP        = baseUrl + '/ajax/getProfile.php'
    updateProfilePHP     = baseUrl + '/ajax/updateProfile.php'
    checkUsernamePHP     = baseUrl + '/ajax/checkUsername.php'
    callRequestPHP       = baseUrl + '/ajax/callRequest.php'
    refreshPHP           = baseUrl + '/ajax/refresh.php'
    logoutPHP            = baseUrl + '/ajax/logout.php'
    accountProfilePHP    = baseUrl + '/ajax/accountsProfile.php'
    
    callsCallPHP         = baseUrl + '/ajax/call.php'
    callsSignalingPHP    = baseUrl + '/ajax/signaling.php'
}

window.isLoggedPHP          = isLoggedPHP
window.checkLoginPHP        = checkLoginPHP
window.mainDataPHP          = mainDataPHP
window.mainChatsPHP         = mainChatsPHP
window.saveTokenPHP         = saveTokenPHP
window.checkTokenPHP        = checkTokenPHP
window.callAnswerPHP        = callAnswerPHP
window.endCallPHP           = endCallPHP
window.uploadPHP            = uploadPHP
window.filePHP              = filePHP
window.searchUsersPHP       = searchUsersPHP
window.createBandPHP        = createBandPHP
window.checkSlugPHP         = checkSlugPHP
window.chatInfoPHP          = chatInfoPHP
window.updateChatPHP        = updateChatPHP
window.getChatInviteLinkPHP = getChatInviteLinkPHP
window.removeParticipantPHP = removeParticipantPHP
window.leaveChatPHP         = leaveChatPHP
window.beenReadPHP          = beenReadPHP
window.chatPHP              = chatPHP
window.ssePHP               = ssePHP
window.sendMessagePHP       = sendMessagePHP
window.sendNotificationPHP  = sendNotificationPHP
window.createInviteLinkPHP  = createInviteLinkPHP
window.readPackagePHP       = readPackagePHP
window.editMessagePHP       = editMessagePHP
window.deleteMessagePHP     = deleteMessagePHP
window.markOnlinePHP        = markOnlinePHP
window.getProfilePHP        = getProfilePHP
window.updateProfilePHP     = updateProfilePHP
window.checkUsernamePHP     = checkUsernamePHP
window.callRequestPHP       = callRequestPHP
window.refreshPHP           = refreshPHP
window.logoutPHP            = logoutPHP
window.accountProfilePHP    = accountProfilePHP

window.callsCallPHP         = callsCallPHP
window.callsSignalingPHP    = callsSignalingPHP

const audioServers = [
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'stun:global.stun.twilio.com:3478' }
]

window.audioServers = audioServers