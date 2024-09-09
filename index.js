const downloadButton = document.getElementById('downloadButton');
const input = document.getElementById('filename');

const pauseButton = document.getElementById('pauseButton');
const resumeButton = document.getElementById('resumeButton');
const cancelButton = document.getElementById('cancelButton');
const progressBar = document.querySelector('.progress');
const progressText = document.querySelector('.pct-text');
const outputText = document.getElementById('output');

let abortController = null;
let downloadedbytes = 0;
let totalbytes = 0;
let isPaused = false;

downloadButton.addEventListener('click', startDownload);
pauseButton.addEventListener('click', pauseDownload);
resumeButton.addEventListener('click', resumeDownload);
cancelButton.addEventListener('click', cancelDownload);

input.addEventListener('input', (e) => {
    if (e.target.value.length > 0 && !isPaused && abortController === null) {
        downloadButton.disabled = false;
    } else downloadButton.disabled = true;
})


async function startDownload() {

    const filename = input.value;
    // const url = `http://127.0.0.1:5500/${filename}`;
    const url = `https://cyborgintell-assignment.s3.ap-south-1.amazonaws.com/${filename}`;

    downloadButton.disabled = true;
    pauseButton.disabled = false;
    resumeButton.disabled = false;
    cancelButton.disabled = false;
    let fileHandle = null;

    try {
        const response = await fetch(url, { method: 'HEAD' });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const contentType = response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';

        console.log(response.headers.get('content-type'));

        const fileExtension = filename.split('.').pop();

        totalbytes = parseInt(response.headers.get('content-length'));

        console.log(totalbytes, contentType, fileExtension);

        if ('showSaveFilePicker' in window) {
            fileHandle = await showSaveFilePicker({//we get a fileSystemFileHandle object
                suggestedName: filename,
                types: [{
                    description: 'File',
                    accept: { [contentType]: [`.${fileExtension}`] }
                }],
            });

            downloadFile(url, contentType, filename, fileHandle);

        } else {
            outputText.textContent = 'Your browser does not support the feature of direct downloads.';
            downloadFile(url, contentType, filename, null);
        }

    } catch (err) {
        downloadButton.disabled = false;
        pauseButton.disabled = true;
        resumeButton.disabled = true;
        cancelButton.disabled = true;
        console.error('Error:', `${err}`);
        if (err.message.includes('404')) outputText.textContent = 'File not found. Please try again.';
        else outputText.textContent = 'An error occurred. Please try again.';
    }
}

async function downloadFile(url, contentType, filename, fileHandle) {
    abortController = new AbortController();
    downloadedbytes = 0;
    isPaused = false;
    let writer;


    try {
        const response = await fetch(url, { signal: abortController.signal });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const reader = response.body.getReader();
        const chunks = [];//when the showSaveFilePicker is not supported to push the binary stream of the file

        if (fileHandle) {
            writer = await fileHandle.createWritable();//FileSystemWritableFileStream object
            /**
             * Any changes made through the stream won't be reflected in the file represented by the file handle until 
             * the stream has been closed. This is typically implemented by writing data to a temporary file, and only 
             * replacing the file represented by file handle with the temporary file when the writable filestream is closed.
             */
        }

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                downloadButton.disabled = false;
                pauseButton.disabled = true;
                resumeButton.disabled = true;
                cancelButton.disabled = true;

                if (fileHandle === null) {
                    const file = new File(chunks, filename, { type: contentType });
                    const url = URL.createObjectURL(file);

                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();

                    //cleanup
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
                break;
            }

            console.log(formatBytes(value.length), value)
            downloadedbytes += value.length;

            if (writer) {
                await writer.write(value);
            } else {
                chunks.push(value);
            }

            updateProgress(downloadedbytes, totalbytes);

            if (isPaused) {
                await new Promise(resolve => resumeButton.onclick = resolve);
                isPaused = false;
            }
        }

        //cleanup
        abortController = null;
        if (writer) await writer.close();

        outputText.textContent = 'Download complete!';

    } catch (err) {
        downloadButton.disabled = false;
        pauseButton.disabled = true;
        resumeButton.disabled = true;
        cancelButton.disabled = true;
        // writer.abort();
        if (err.name === 'AbortError') {
            console.log('Download cancelled');
            outputText.textContent = 'Download cancelled.';
        } else {
            console.error('Download failed:', err);
            outputText.textContent = 'Download failed. Please try again.';
        }
    } finally {
        if (writer) await writer.close();
    }
}

function pauseDownload() {
    isPaused = true;
    outputText.textContent = 'Download paused. Click resume to continue.';
}

async function resumeDownload() {
    isPaused = false;
    outputText.textContent = 'Resuming download...';
}

function cancelDownload() {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    isPaused = false;
    downloadButton.disabled = false;
    pauseButton.disabled = true;
    resumeButton.disabled = true;
    cancelButton.disabled = true;
    progressText.textContent = 0;
    progressBar.style.setProperty('--percentage', 0);
    outputText.textContent = 'Download cancelled.';
}



function updateProgress(downloaded, total) {
    const percentage = total ? Math.round((downloaded / total) * 100) : 0;
    progressText.textContent = percentage;
    progressBar.style.setProperty('--percentage', percentage);
    outputText.textContent = `${percentage}% downloaded (${formatBytes(downloaded)} / ${formatBytes(total)})`;
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes.toFixed(2)} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

