class Base64Converter {
    constructor() {
        this.CHUNK_SIZE = 1024 * 1024 * 2; // 2MB chunks
        this.file = null;
        this.initEventListeners();
    }

    initEventListeners() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const encodeBtn = document.getElementById('encode-btn');
        const decodeBtn = document.getElementById('decode-btn');

        // Prevent double file dialog
        dropZone.addEventListener('click', (e) => {
            e.preventDefault();
            fileInput.click();
        });

        dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        dropZone.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        encodeBtn.addEventListener('click', () => this.processFile('encode'));
        decodeBtn.addEventListener('click', () => this.processFile('decode'));

        // Prevent file input from triggering multiple times
        fileInput.addEventListener('click', (e) => e.stopPropagation());
    }

    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('drop-zone').classList.add('active');
    }

    handleDrop(e) {
        e.preventDefault();
        document.getElementById('drop-zone').classList.remove('active');
        const files = e.dataTransfer.files;
        if (files.length) this.setFile(files[0]);
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length) this.setFile(files[0]);
    }

    setFile(file) {
        if (!file) {
            this.showStatus('No file selected', 'error');
            return;
        }

        if (file.size > 100 * 1024 * 1024) { // 100MB limit
            this.showStatus('File too large (max 100MB)', 'error');
            return;
        }

        // Warn about binary files
        if (this.isBinaryFile(file.name)) {
            this.showStatus('Warning: Binary file detected. Encoding may produce large output.', 'warning');
        }

        this.file = file;
        this.showStatus(`File selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`, 'success');
    }

    async processFile(operation) {
        if (!this.file) {
            return this.showStatus('Please select a file first', 'error');
        }

        try {
            this.setLoading(true);
            const startTime = performance.now();
            let result;
            let originalName = '';

            if (operation === 'encode') {
                result = await this.encodeFile(this.file);
            } else {
                const fileContent = await this.file.text();
                if (!this.isValidBase64(fileContent)) {
                    return this.showStatus('Invalid Base64 format', 'error');
                }
                // Extract original filename if available
                originalName = fileContent.split(',')[0] || '';
                result = await this.decodeFile(this.file);
            }

            const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(2);
            this.downloadResult(result, operation, originalName);
            this.showStatus(`Operation completed in ${elapsedTime}s`, 'success');
        } catch (error) {
            this.showStatus(`Error: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
            this.updateProgress(0);
        }
    }

    async encodeFile(file) {
        let offset = 0;
        let base64 = `data:${file.type || 'application/octet-stream'};base64,`;

        while (offset < file.size) {
            const chunk = file.slice(offset, offset + this.CHUNK_SIZE);
            const arrayBuffer = await this.readChunk(chunk);
            const uint8Array = new Uint8Array(arrayBuffer);
            base64 += base64js.fromByteArray(uint8Array);
            offset += this.CHUNK_SIZE;
            this.updateProgress(offset / file.size);
            await this.delay(0);
        }

        return base64;
    }

    async decodeFile(file) {
        const text = await file.text();
        const base64Data = text.split(',')[1] || text; // Remove data URL prefix if present
        const byteArrays = [];
        let offset = 0;

        while (offset < base64Data.length) {
            const chunk = base64Data.substr(offset, this.CHUNK_SIZE);
            byteArrays.push(base64js.toByteArray(chunk));
            offset += this.CHUNK_SIZE;
            this.updateProgress(offset / base64Data.length);
            await this.delay(0);
        }

        return new Blob(byteArrays);
    }

    // Helper methods
    readChunk(chunk) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(chunk);
        });
    }

    updateProgress(percentage) {
        document.getElementById('progress-bar').style.width = `${percentage * 100}%`;
    }

    showStatus(message, type = 'info') {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
    }

    downloadResult(data, operation, originalName) {
        const blob = new Blob([data]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        let extension = 'bin';
        if (operation === 'encode') {
            extension = 'b64';
        } else if (originalName) {
            // Try to get original extension from Base64 header
            const match = originalName.match(/^data:(.*?);base64/);
            if (match && match[1]) {
                const mimeType = match[1];
                extension = mimeType.split('/')[1] || 'bin';
            }
        }

        a.href = url;
        a.download = `file.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    isValidBase64(str) {
        const base64Regex = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/;
        const base64Data = str.split(',')[1] || str; // Remove data URL prefix if present
        return base64Regex.test(base64Data);
    }

    isBinaryFile(filename) {
        const binaryExtensions = ['bin', 'exe', 'dll', 'so', 'dmg', 'img'];
        return binaryExtensions.includes(this.getFileExtension(filename));
    }

    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    setLoading(isLoading) {
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(btn => btn.disabled = isLoading);
        document.getElementById('drop-zone').style.opacity = isLoading ? 0.5 : 1;
    }
}

// Initialize application
new Base64Converter();