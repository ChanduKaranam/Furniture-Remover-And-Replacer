const BACKEND_URL = "http://localhost:5000";

// Global state variables
let currentStep = 1;
let uploadedImage = null;
let textInput = '';
let isProcessing = false;
let processedImage = null;
let selectedBed = null;
let fabricCanvas = null;
let canvasHistory = [];
let historyIndex = -1;

const beds = [
    {
        id: 1,
        image: 'static/images/Bed1.png',
        name: 'Wake Fit Bed 1'
    },
    {
        id: 2,
        image: 'static/images/Bed2.png',
        name: 'Wake Fit Bed 2'
    },
    {
        id: 3,
        image: 'static/images/Bed3.png',
        name: 'Wake Fit Bed 3'
    },
    {
        id: 4,
        image: 'static/images/Sofa1.png',
        name: 'Wake Fit Sofa'
    }
];

// DOM elements
const sections = {
    step1: document.getElementById('step1'),
    step2: document.getElementById('step2'),
    step3: document.getElementById('step3'),
    step4: document.getElementById('step4')
};
const uploadArea = document.getElementById('uploadArea');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const uploadedImagePreview = document.getElementById('uploadedImagePreview');
const changeImageBtn = document.getElementById('changeImageBtn');
const fileInput = document.getElementById('fileInput');
const objectDescription = document.getElementById('objectDescription');
const previewBtn = document.getElementById('previewBtn');
const originalPreviewInStep2 = document.getElementById('originalPreviewInStep2');
const removalDescription = document.getElementById('removalDescription');
const processBtn = document.getElementById('processBtn');
const backToStep1Btn = document.getElementById('backToStep1');
const editBtn = document.getElementById('editBtn');
const processedRoomImage = document.getElementById('processedRoomImage');
const bedOptionsContainer = document.getElementById('bedOptionsContainer');
const backToStep2Btn = document.getElementById('backToStep2');
const fabricCanvasElement = document.getElementById('fabricCanvas');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const moveBtn = document.getElementById('moveBtn');
const resizeBtn = document.getElementById('resizeBtn');
const rotateBtn = document.getElementById('rotateBtn');
const backToStep3Btn = document.getElementById('backToStep3');
const saveDesignBtn = document.getElementById('saveDesignBtn');
const outputSection = document.getElementById('outputSection');
const finalDesignImage = document.getElementById('finalDesignImage');
const startNewDesignBtn = document.getElementById('startNewDesignBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const featuresSection = document.getElementById('featuresSection');
const progressBarFill = document.getElementById('progressBarFill');
const progressText = document.getElementById('progressText');

// Helper
function updatePreviewButtonState() {
    if (uploadedImage && objectDescription.value.trim()) {
        previewBtn.removeAttribute('disabled');
        previewBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        previewBtn.setAttribute('disabled', 'true');
        previewBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}
function renderStep() {
    Object.values(sections).forEach(s => s.classList.add('hidden'));
    outputSection.classList.add('hidden');
    if (sections[`step${currentStep}`]) sections[`step${currentStep}`].classList.remove('hidden');
    featuresSection.classList.toggle('hidden', currentStep !== 1);
    progressBarFill.style.width = `${((currentStep - 1) / 3) * 100}%`;
    progressText.textContent = `Step ${currentStep} of 4`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}
function dataURLtoBlob(dataurl) {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
}

// Core flow
function handlePreview() {
    textInput = objectDescription.value.trim();
    originalPreviewInStep2.src = uploadedImage;
    removalDescription.textContent = textInput;
    currentStep = 2;
    renderStep();
}
async function handleProcessImage() {
    if (!uploadedImage || !textInput) return;
    showLoading(true);
    try {
        const imageBlob = dataURLtoBlob(uploadedImage);
        const formData = new FormData();
        formData.append("image", imageBlob, "uploaded_image.png");
        formData.append("description", textInput);

        const res = await fetch(`${BACKEND_URL}/remove_object`, {
            method: "POST",
            body: formData
        });
        const result = await res.json();
        if (res.ok && result.edited_image_url) {
            processedImage = result.edited_image_url;
            processedRoomImage.src = processedImage;
            currentStep = 3;
            renderStep();
            renderBedOptions();
        } else {
            alert(result.error || "Image processing failed.");
        }
    } catch (e) {
        alert("Error connecting to backend.");
        console.error(e);
    } finally {
        showLoading(false);
    }
}

// UI interaction
function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = event => {
            uploadedImage = event.target.result;
            uploadedImagePreview.src = uploadedImage;
            uploadedImagePreview.classList.remove('hidden');
            uploadPlaceholder.classList.add('hidden');
            changeImageBtn.classList.remove('hidden');
            updatePreviewButtonState();
        };
        reader.readAsDataURL(file);
    }
}
function renderBedOptions() {
    bedOptionsContainer.innerHTML = '';
    beds.forEach(bed => {
        const div = document.createElement('div');
        div.className = `bg-white rounded-lg shadow-md overflow-hidden transform transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer bed-option ${selectedBed === bed.image ? 'ring-2 ring-indigo-600' : ''}`;
        div.innerHTML = `
            <div class="relative">
                <img src="${bed.image}" alt="${bed.name}" class="w-full h-48 object-cover" />
                ${selectedBed === bed.image ? '<div class="absolute top-2 right-2 bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center"><i class="fas fa-check text-sm"></i></div>' : ''}
            </div>
            <div class="p-4">
                <h4 class="text-gray-900 font-medium">${bed.name}</h4>
            </div>
        `;
        div.addEventListener('click', () => handleSelectBed(bed.image));
        bedOptionsContainer.appendChild(div);
    });
}
function handleSelectBed(bedImage) {
    selectedBed = bedImage;
    renderBedOptions();
    showLoading(true);
    setTimeout(() => {
        showLoading(false);
        currentStep = 4;
        renderStep();
        initFabricCanvas();
    }, 1000);
}

function initFabricCanvas() {
    if (!fabricCanvasElement || !processedImage || !selectedBed) return;
    if (fabricCanvas) fabricCanvas.dispose();
    
    // First, load the processed image to get its natural dimensions
    const img = new Image();
    img.onload = function() {
        const imgWidth = img.naturalWidth;
        const imgHeight = img.naturalHeight;
        console.log(`Image natural dimensions: ${imgWidth}x${imgHeight}`);
        
        // Initialize the canvas with the actual image dimensions
        const canvas = new fabric.Canvas('fabricCanvas', { 
            selection: true, 
            centeredRotation: true,
            width: imgWidth,
            height: imgHeight
        });
        fabricCanvas = canvas;
        
        // Set both CSS and internal dimensions to match the image
        canvas.setDimensions({ width: imgWidth, height: imgHeight });
        
        // Adjust the container to fit the canvas
        const container = fabricCanvasElement.parentElement;
        if (container) {
            container.style.width = `${imgWidth}px`;
            container.style.height = `${imgHeight}px`;
            container.style.overflow = 'auto';
        }
        
        // Load the image as background at its natural size
        fabric.Image.fromURL(processedImage, (fabricImg) => {
            fabricImg.set({
                left: 0,
                top: 0,
                selectable: false,
                scaleX: 1,
                scaleY: 1
            });
            
            canvas.setBackgroundImage(fabricImg, canvas.renderAll.bind(canvas));
            
            // Now load the bed image
            fabric.Image.fromURL(selectedBed, bedImg => {
                const bedScale = Math.min(canvas.width * 0.5 / bedImg.width, canvas.height * 0.5 / bedImg.height);
                bedImg.scale(bedScale).set({
                    left: canvas.width / 2 - (bedImg.width * bedScale) / 2,
                    top: canvas.height / 2 - (bedImg.height * bedScale) / 2,
                    cornerColor: '#6366F1',
                    cornerStrokeColor: '#ffffff',
                    borderColor: '#6366F1',
                    cornerSize: 10,
                    transparentCorners: false,
                    centeredScaling: true
                });
                canvas.add(bedImg);
                canvas.setActiveObject(bedImg);
                canvas.renderAll();
                saveCanvasState();
            });
        });
        
        function saveCanvasState() {
            if (historyIndex < canvasHistory.length - 1) {
                canvasHistory = canvasHistory.slice(0, historyIndex + 1);
            }
            canvasHistory.push(JSON.stringify(canvas));
            historyIndex++;
        }

        canvas.on('object:modified', saveCanvasState);

        undoBtn.onclick = () => {
            if (historyIndex > 0) {
                historyIndex--;
                canvas.loadFromJSON(canvasHistory[historyIndex], canvas.renderAll.bind(canvas));
            }
        };
        redoBtn.onclick = () => {
            if (historyIndex < canvasHistory.length - 1) {
                historyIndex++;
                canvas.loadFromJSON(canvasHistory[historyIndex], canvas.renderAll.bind(canvas));
            }
        };
        zoomInBtn.onclick = () => canvas.setZoom(canvas.getZoom() * 1.1);
        zoomOutBtn.onclick = () => canvas.setZoom(canvas.getZoom() * 0.9);

        moveBtn.onclick = () => setMode('move');
        resizeBtn.onclick = () => setMode('resize');
        rotateBtn.onclick = () => setMode('rotate');

        function setMode(mode) {
            const obj = canvas.getActiveObject();
            if (!obj) return;
            obj.lockMovementX = obj.lockMovementY = obj.lockScalingX = obj.lockScalingY = obj.lockRotation = false;
            if (mode === 'move') obj.lockScalingX = obj.lockScalingY = obj.lockRotation = true;
            if (mode === 'resize') obj.lockMovementX = obj.lockMovementY = obj.lockRotation = true;
            if (mode === 'rotate') obj.lockMovementX = obj.lockMovementY = obj.lockScalingX = obj.lockScalingY = true;
            canvas.renderAll();
        }
    };
    img.src = processedImage;
}
function handleSaveDesign() {
    if (!fabricCanvas) return;
    const dataURL = fabricCanvas.toDataURL({ format: 'png', quality: 1 });
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'room-design.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    finalDesignImage.src = dataURL;
    sections.step4.classList.add('hidden');
    outputSection.classList.remove('hidden');
    canvasHistory = [];
    historyIndex = -1;
}

document.addEventListener('DOMContentLoaded', () => {
    renderStep();
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileUpload);
    uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('bg-indigo-100'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('bg-indigo-100'));
    uploadArea.addEventListener('drop', e => { e.preventDefault(); handleFileUpload({ target: e.dataTransfer }); });
    changeImageBtn.addEventListener('click', e => {
        e.stopPropagation();
        uploadedImage = null;
        uploadedImagePreview.src = '';
        uploadedImagePreview.classList.add('hidden');
        uploadPlaceholder.classList.remove('hidden');
        changeImageBtn.classList.add('hidden');
        fileInput.value = '';
        objectDescription.value = '';
        updatePreviewButtonState();
    });
    objectDescription.addEventListener('input', updatePreviewButtonState);
    previewBtn.addEventListener('click', handlePreview);
    backToStep1Btn.addEventListener('click', () => { currentStep = 1; renderStep(); });
    editBtn.addEventListener('click', () => { currentStep = 1; renderStep(); });
    processBtn.addEventListener('click', handleProcessImage);
    backToStep2Btn.addEventListener('click', () => { currentStep = 2; renderStep(); });
    backToStep3Btn.addEventListener('click', () => { currentStep = 3; renderStep(); renderBedOptions(); });
    saveDesignBtn.addEventListener('click', handleSaveDesign);
    startNewDesignBtn.addEventListener('click', () => {
        uploadedImage = textInput = processedImage = selectedBed = null;
        uploadedImagePreview.src = '';
        uploadedImagePreview.classList.add('hidden');
        uploadPlaceholder.classList.remove('hidden');
        changeImageBtn.classList.add('hidden');
        fileInput.value = '';
        objectDescription.value = '';
        updatePreviewButtonState();
        outputSection.classList.add('hidden');
        currentStep = 1;
        renderStep();
    });
});
