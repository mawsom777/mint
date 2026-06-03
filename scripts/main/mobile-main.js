class MobileNavigation {
    constructor() {
        this.isMobile = window.innerWidth <= 767;
        this.chatsContainer = document.querySelector('.chats-container');
        this.messagesContainer = document.querySelector('.messages-container');
        this.openChatsBtn = document.querySelector('.open-chats');
        this.backToMessagesBtn = document.querySelector('.back-to-messages');

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkInitialState();
        this.setupResizeHandler();
    }

    setupEventListeners() {
        if (this.openChatsBtn) {
            this.openChatsBtn.addEventListener('click', () => this.showChats());
        }

        if (this.backToMessagesBtn) {
            this.backToMessagesBtn.addEventListener('click', () => this.showMessages());
        }

        window.addEventListener('resize', () => this.handleResize());
    }

    checkInitialState() {
        if (this.isMobile) {
            this.showChats();
        }
    }

    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 767;

        if (wasMobile !== this.isMobile) {
            if (this.isMobile) {
                // Переход на мобильную версию
                this.showChats();
            } else {
                // Переход на десктопную версию
                this.showBoth();
            }
        }
    }

    showChats() {
        if (!this.isMobile) return;

        this.chatsContainer.style.display = 'flex';
        this.messagesContainer.classList.remove('active');

        if (this.backToMessagesBtn) {
            this.backToMessagesBtn.style.display = 'flex';
        }

        if (this.openChatsBtn) {
            this.openChatsBtn.style.display = 'none';
        }
    }

    showMessages() {
        if (!this.isMobile) return;

        this.chatsContainer.style.display = 'none';
        this.messagesContainer.classList.add('active');

        if (this.backToMessagesBtn) {
            this.backToMessagesBtn.style.display = 'none';
        }

        if (this.openChatsBtn) {
            this.openChatsBtn.style.display = 'flex';
        }
    }

    showBoth() {
        this.chatsContainer.style.display = 'flex';
        this.messagesContainer.style.display = 'flex';
        this.messagesContainer.classList.remove('active');

        if (this.openChatsBtn) this.openChatsBtn.style.display = 'none';
        if (this.backToMessagesBtn) this.backToMessagesBtn.style.display = 'none';
    }
}

window.MobileNavigation = MobileNavigation;