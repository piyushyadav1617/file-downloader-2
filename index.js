document.addEventListener('DOMContentLoaded', () => {
    const downloadButton = document.getElementById('downloadButton');
    const pauseButton = document.getElementById('pauseButton');
    const resumeButton = document.getElementById('resumeButton');
    const cancelButton = document.getElementById('cancelButton');
    const progressBar = document.querySelector('.progress');
    const progressText = document.querySelector('.pct-text');
    const outputText = document.getElementById('output');
    const input = document.getElementById('filename');

    let abortController = null;
    let fileHandle = null;
    let downloadedSize = 0;
    let totalSize = 0;
    let isPaused = false;

    downloadButton.addEventListener('click', startDownload);
    pauseButton.addEventListener('click', pauseDownload);
    resumeButton.addEventListener('click', resumeDownload);
    cancelButton.addEventListener('click', cancelDownload);
    input.addEventListener('input', (e) => {
        if (e.target.value.length > 0) {
            downloadButton.disabled = false;
        } else downloadButton.disabled = true;
    })


    async function startDownload() {
        const filename = input.value;
        
        const url = `https://cyborgintell-assignment.s3.ap-south-1.amazonaws.com/${filename}`;
        downloadButton.disabled = true;
        pauseButton.disabled = false;
        resumeButton.disabled = false;
        cancelButton.disabled = false;
        try {
            const response = await fetch(url, { method: 'HEAD' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const contentType = response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';

            console.log(response.headers.get('content-type'));
            const fileExtension = filename.split('.').pop();
            totalSize = parseInt(response.headers.get('content-length'));
            console.log(totalSize, contentType, fileExtension);
            if ('showSaveFilePicker' in window) {
                fileHandle = await showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'File',
                        accept: { [contentType]: [`.${fileExtension}`] }
                    }],
                });
                downloadFile(url, fileHandle, contentType);
            } else {
                downloadButton.disabled = false;
                pauseButton.disabled = true;
                resumeButton.disabled = true;
                cancelButton.disabled = true;
                outputText.textContent = 'Your browser does not support the required features.';
                traditionalDownload(url, filename);
            }
        } catch (err) {
            downloadButton.disabled = false;
            pauseButton.disabled = true;
            resumeButton.disabled = true;
            cancelButton.disabled = true;
            console.error('Error:', err);
            outputText.textContent = 'An error occurred. Please try again.';
        }
    }

    async function downloadFile(url, fileHandle, contentType) {
        abortController = new AbortController();
        downloadedSize = 0;
        isPaused = false;

        try {
            const response = await fetch(url, { signal: abortController.signal });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const reader = response.body.getReader();
            const writer = await fileHandle.createWritable();

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    downloadButton.disabled = false;
                    pauseButton.disabled = true;
                    resumeButton.disabled = true;
                    cancelButton.disabled = true;
                    break;
                }

                console.log(formatBytes(value.length), value)
                downloadedSize += value.length;
                await writer.write(value);

                updateProgress(downloadedSize, totalSize);

                if (isPaused) {
                    await new Promise(resolve => resumeButton.onclick = resolve);
                    isPaused = false;
                }
            }

            await writer.close();

            outputText.textContent = 'Download complete!';
        } catch (err) {
            downloadButton.disabled = false;
            pauseButton.disabled = true;
            resumeButton.disabled = true;
            cancelButton.disabled = true;
            if (err.name === 'AbortError') {
                console.log('Download cancelled');
                outputText.textContent = 'Download cancelled.';
            } else {
                console.error('Download failed:', err);
                outputText.textContent = 'Download failed. Please try again.';
            }
        }
    }

    function pauseDownload() {
        isPaused = true;
        outputText.textContent = 'Download paused. Click resume to continue.';
    }

    async function resumeDownload() {
        if (!fileHandle) {
            outputText.textContent = 'No active download to resume.';
            return;
        }

        isPaused = false;
        outputText.textContent = 'Resuming download...';
    }

    function cancelDownload() {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
        downloadButton.disabled = false;
        pauseButton.disabled = true;
        resumeButton.disabled = true;
        cancelButton.disabled = true;
        // updateProgress(0, 0);
        progressText.textContent = 0;
        progressBar.style.setProperty('--percentage', 0);
        outputText.textContent = 'Download cancelled.';
    }

    function traditionalDownload(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function updateProgress(downloaded, total) {
        const percentage = total ? Math.round((downloaded / total) * 100) : 0;
        progressText.textContent = percentage;
        progressBar.style.setProperty('--percentage', percentage);
        outputText.textContent = `${percentage}% downloaded (${formatBytes(downloaded)} / ${formatBytes(total)})`;
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});