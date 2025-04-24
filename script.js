const imageQueue = document.getElementById('imageQueue');
const convertButton = document.getElementById('convertButton');
const clearImagesButton = document.getElementById('clearImagesButton');
const uploadInput = document.getElementById('uploadInput');
const results = document.getElementById('results');
const chatbotHeader = document.getElementById('chatbot-header');
const chatbotBody = document.getElementById('chatbot-body');
const chatbotMessages = document.getElementById('chatbot-messages');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotSend = document.getElementById('chatbot-send');
const clearChatButton = document.getElementById('clearChatButton');

let images = [];

function addImageToQueue(url, blob) {
    const container = document.createElement('div');
    container.className = 'image-container';
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Imagem para OCR';
    const removeButton = document.createElement('button');
    removeButton.textContent = 'Remover';
    removeButton.className = 'remove-button';
    removeButton.onclick = () => {
        container.remove();
        images = images.filter(image => image.url !== url);
    };
    container.appendChild(img);
    container.appendChild(removeButton);
    imageQueue.appendChild(container);
    images.push({ blob, container, url });
}

uploadInput.addEventListener('change', (event) => {
    const files = event.target.files;
    for (const file of files) {
        const url = URL.createObjectURL(file);
        addImageToQueue(url, file);
    }
});

document.addEventListener('paste', (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
        if (item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) {
                const url = URL.createObjectURL(blob);
                addImageToQueue(url, blob);
            }
        }
    }
});

convertButton.addEventListener('click', async () => {
    if (images.length === 0) {
        results.innerHTML = '<p>Nenhuma imagem na fila.</p>';
        return;
    }
    results.innerHTML = '';
    convertButton.disabled = true;
    convertButton.textContent = 'Processando...';

    const processingPromises = images.map(async (imageInfo) => {
        const { blob, container, url } = imageInfo;
        const resultBlock = document.createElement('div');
        resultBlock.className = 'result-block';
        const imgClone = container.querySelector('img').cloneNode();
        resultBlock.appendChild(imgClone);
        const textElement = document.createElement('p');
        textElement.textContent = 'Processando...';
        resultBlock.appendChild(textElement);
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.textContent = 'Copiar';
        copyButton.disabled = true;
        resultBlock.appendChild(copyButton);
        results.appendChild(resultBlock);

        try {
            if (typeof Tesseract === 'undefined') {
                throw new Error('Tesseract library não carregada.');
            }
            const { data: { text: extractedText } } = await Tesseract.recognize(blob, 'eng');
            const finalText = extractedText || '[Nenhum texto detectado]';
            textElement.textContent = finalText;

            if (extractedText) {
                copyButton.disabled = false;
                copyButton.onclick = () => {
                    navigator.clipboard.writeText(finalText).then(() => {
                        copyButton.textContent = 'Copiado!';
                        copyButton.disabled = true;
                        setTimeout(() => {
                            copyButton.textContent = 'Copiar';
                            copyButton.disabled = false;
                        }, 2000);
                    }).catch(() => {
                        const copyErrorSpan = document.createElement('span');
                        copyErrorSpan.textContent = ' (Falha ao copiar)';
                        copyErrorSpan.style.color = 'orange';
                        copyButton.insertAdjacentElement('afterend', copyErrorSpan);
                        setTimeout(() => copyErrorSpan.remove(), 3000);
                    });
                };
            }
        } catch (error) {
            textElement.textContent = 'Erro ao processar a imagem.';
            textElement.style.color = 'red';
            copyButton.disabled = true;
        } finally {
            URL.revokeObjectURL(url);
        }
    });

    try {
        await Promise.all(processingPromises);
    } catch {
        results.innerHTML += '<p style="color: red;">Ocorreu um erro durante o processamento de algumas imagens.</p>';
    } finally {
        images = [];
        imageQueue.innerHTML = '';
        convertButton.disabled = false;
        convertButton.textContent = 'Converter';
    }
});

clearImagesButton.addEventListener('click', () => {
    images = [];
    imageQueue.innerHTML = '';
    results.innerHTML = '';
});

function appendChatMessage(text, className) {
    const messageElement = document.createElement('div');
    messageElement.textContent = text;
    messageElement.style.marginBottom = '10px';
    if (className === 'ai-message') {
        messageElement.style.color = '#555';
    } else if (className === 'error-message') {
        messageElement.style.color = 'red';
        messageElement.style.fontStyle = 'italic';
    }
    chatbotMessages.appendChild(messageElement);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
    return messageElement;
}

async function getAIResponse(message) {
    const GEMINI_API_KEY = 'AIzaSyCLziDolEAlM4Z5PqQMfNEi3XZvLdA6YKE';
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    try {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Responda em português e seja direta: ${message}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 150
                }
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData?.error?.message || `Erro ${response.status} ao contatar a IA.`;
            return errorMessage;
        }
        const data = await response.json();
        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            return data.candidates[0].content.parts[0].text.trim();
        } else {
            return 'Desculpe, a resposta da IA veio em um formato inesperado.';
        }
    } catch (error) {
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            return 'Desculpe, ocorreu um erro de rede ao tentar falar com a IA. Verifique sua conexão.';
        }
        return 'Desculpe, ocorreu um erro inesperado ao tentar falar com a IA.';
    }
}

chatbotHeader.addEventListener('click', () => {
    chatbotBody.classList.toggle('open');
});

chatbotSend.addEventListener('click', async () => {
    const userMessage = chatbotInput.value.trim();
    if (!userMessage) return;
    chatbotInput.value = '';
    appendChatMessage(`Você: ${userMessage}`, 'user-message');
    const thinkingMessage = appendChatMessage('IA: Pensando...', 'ai-message');
    thinkingMessage.setAttribute('aria-live', 'polite');
    try {
        const responseMessage = await getAIResponse(userMessage);
        thinkingMessage.textContent = `IA: ${responseMessage}`;
    } catch {
        thinkingMessage.textContent = 'IA: Desculpe, ocorreu um erro inesperado ao exibir a resposta.';
        thinkingMessage.style.color = 'red';
    }
});

chatbotInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        chatbotSend.click();
    }
});

clearChatButton.addEventListener('click', () => {
    chatbotMessages.innerHTML = '';
});