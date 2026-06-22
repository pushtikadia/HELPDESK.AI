import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Upload,
    X,
    ImageIcon,
    ArrowRight,
    Sparkles,
    BrainCircuit,
    AlertCircle,
    CheckCircle2,
    Clock,
    Mic,
    MicOff,
    Loader2,
    Volume2,
    Globe,
    ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import Tesseract from 'tesseract.js';
import { translateText, SUPPORTED_LANGUAGES } from '../../services/translationService';

const CreateTicket = () => {
    // Initialize states from localStorage if a draft exists
    const [issue, setIssue] = useState(() => {
        return localStorage.getItem('ticket_draft_issue') || '';
    });
    const [selectedLanguage, setSelectedLanguage] = useState(() => {
        return localStorage.getItem('ticket_draft_lang') || 'en';
    });

    const [file, setFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [extractedOCR, setExtractedOCR] = useState('');
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();
    const MAX_CHARS = 1000;
    const supportsSpeech = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    const [isTranslating, setIsTranslating] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const langRef = useRef(null);

    // Voice UI states
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [voiceTranscript, setVoiceTranscript] = useState('');
    const [interimVoice, setInterimVoice] = useState('');

    // Voice Refs & Visualizer
    const recognitionRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const dataArrayRef = useRef(null);
    const animationFrameRef = useRef(null);
    const [visualizerData, setVisualizerData] = useState(new Array(16).fill(15));
    const streamRef = useRef(null);

    // Auto-save draft changes to localStorage
    useEffect(() => {
        localStorage.setItem('ticket_draft_issue', issue);
        localStorage.setItem('ticket_draft_lang', selectedLanguage);
    }, [issue, selectedLanguage]);

    useEffect(() => {
        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
            if (audioContextRef.current) audioContextRef.current.close();
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    // Close language dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (langRef.current && !langRef.current.contains(event.target)) {
                setIsLangOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Clean up preview URL on unmount
    useEffect(() => {
        return () => {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
        };
    }, [imagePreview]);

    const processOCR = async (imageFile) => {
        setIsOcrLoading(true);
        try {
            const { data: { text } } = await Tesseract.recognize(imageFile, 'eng');
            setExtractedOCR(text.trim());
        } catch (err) {
            console.error("OCR Failed:", err);
        } finally {
            setIsOcrLoading(false);
        }
    };

    const toggleMic = () => {
        if (isListening) {
            stopListening();
            return;
        }
        startListening();
    };

    const startListening = async () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            setError("Speech recognition is not supported in this browser.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContextRef.current = new AudioContext();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            const analyser = audioContextRef.current.createAnalyser();
            analyser.fftSize = 64;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyserRef.current = analyser;
            dataArrayRef.current = dataArray;
            source.connect(analyser);

            const updateVisualizer = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArrayRef.current);
                const bars = [];
                for (let i = 0; i < 16; i++) {
                    const val = dataArrayRef.current[i] || 0;
                    const height = Math.max(5, (val / 255) * 50);
                    bars.push(height);
                }
                setVisualizerData(bars);
                animationFrameRef.current = requestAnimationFrame(updateVisualizer);
            };
            updateVisualizer();

            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = (event) => {
                let finalStr = '';
                let interimStr = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalStr += event.results[i][0].transcript;
                    } else {
                        interimStr += event.results[i][0].transcript;
                    }
                }
                if (finalStr) setVoiceTranscript(prev => prev + ' ' + finalStr);
                setInterimVoice(interimStr);
            };

            recognition.onerror = (event) => {
                console.error("Speech Recognition Error:", event.error);
                if (event.error !== 'no-speech') {
                    setError(`Microphone error: ${event.error}`);
                }
            };

            recognition.onend = () => {
                if (!isListening) {
                    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                }
            };

            recognitionRef.current = recognition;
            recognition.start();

            setIsListening(true);
            setShowVoiceModal(true);
            setVoiceTranscript('');
            setInterimVoice('');
            setError('');

        } catch (err) {
            console.error("Microphone access denied:", err);
            setError("Could not access microphone. Please ensure permissions are granted.");
        }
    };

    const stopListening = () => {
        setIsListening(false);
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const handleSaveVoice = () => {
        stopListening();
        setIssue(prev => {
            const combined = prev + ' ' + voiceTranscript + ' ' + interimVoice;
            return combined.trim().substring(0, MAX_CHARS);
        });
        setShowVoiceModal(false);
    };

    const handleCancelVoice = () => {
        stopListening();
        setShowVoiceModal(false);
    };

    const handleFileChange = (e) => {
        const selected = e.target.files?.[0];
        if (selected && (selected.type === 'image/png' || selected.type === 'image/jpeg')) {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
            setFile(selected);
            setImagePreview(URL.createObjectURL(selected));
            setError('');
            processOCR(selected);
        } else if (selected) {
            setError('Please upload only PNG or JPG images.');
        }
    };

    const removeFile = () => {
        setFile(null);
        setExtractedOCR('');
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile && (droppedFile.type === 'image/png' || droppedFile.type === 'image/jpeg')) {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
            setFile(droppedFile);
            setImagePreview(URL.createObjectURL(droppedFile));
            setError('');
            processOCR(droppedFile);
        }
    };

    const handleAnalyze = async (e) => {
        e.preventDefault();
        if (!issue.trim()) {
            setError('Please describe your issue first.');
            return;
        }

        if (file && !isOcrLoading && !extractedOCR.trim()) {
            setError('No text could be extracted from the image. Please upload a clear screenshot containing text, or remove the image to continue.');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            let textToSubmit = issue;

            if (selectedLanguage !== 'en') {
                setIsTranslating(true);
                textToSubmit = await translateText(issue, selectedLanguage, 'en');
                setIsTranslating(false);
            }

            let imageBase64 = "";
            let extractedOCRText = extractedOCR;
            if (file) {
                imageBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        resolve(reader.result);
                    };
                    reader.readAsDataURL(file);
                });
            }

            // Clear the local storage draft once submission initiates successfully
            localStorage.removeItem('ticket_draft_issue');
            localStorage.removeItem('ticket_draft_lang');

            navigate('/ai-processing', {
                state: {
                    text: textToSubmit,
                    original_text: issue,
                    original_language: selectedLanguage,
                    image_base64: imageBase64,
                    image_text: extractedOCRText
                }
            });

        } catch (err) {
            console.error(err);
            setError('Failed to submit ticket. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f6f8f7] pb-20">
            <main className="pt-32 px-6">
                <div className="w-full max-w-2xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-full"
                    >
                        <Card className="border-none shadow-sm hover:shadow-md transition-shadow duration-300 rounded-3xl bg-white overflow-hidden h-full flex flex-col">
                            <CardHeader className="p-8 pb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                                        <Sparkles size={18} className="fill-emerald-600" />
                                    </div>
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Workspace</span>
                                </div>
                                <CardTitle className="text-3xl font-bold text-gray-900 tracking-tight">Report a New Issue</CardTitle>
                                <CardDescription className="text-base text-gray-500">
                                    Describe the problem and our AI will analyze it instantly.
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="p-8 pt-2 flex-grow flex flex-col">
                                <form onSubmit={handleAnalyze} className="space-y-6 flex-grow flex flex-col">
                                    <div className="space-y-2 flex-grow flex flex-col relative">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-bold text-gray-700">Describe your issue</label>
                                            <span className={`text-xs font-semibold ${issue.length >= MAX_CHARS ? 'text-red-500' : 'text-gray-400'}`}>
                                                {issue.length} / {MAX_CHARS}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider shrink-0">Language:</label>
                                            <div className="relative flex-1" ref={langRef}>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsLangOpen(!isLangOpen)}
                                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-700 flex items-center justify-between hover:bg-white hover:border-emerald-200 transition-all shadow-sm group"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <Globe size={14} className="text-emerald-500" />
                                                        {SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.label}
                                                    </span>
                                                    <motion.div
                                                        animate={{ rotate: isLangOpen ? 180 : 0 }}
                                                        className="text-gray-400 group-hover:text-emerald-500 transition-colors"
                                                    >
                                                        <ChevronDown size={16} />
                                                    </motion.div>
                                                </button>

                                                <AnimatePresence>
                                                    {isLangOpen && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                            animate={{ opacity: 1, y: 5, scale: 1 }}
                                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                            className="absolute z-50 top-full left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-2xl shadow-emerald-900/10 p-2 overflow-hidden"
                                                        >
                                                            <div className="max-h-[220px] overflow-y-auto custom-scrollbar space-y-1">
                                                                {SUPPORTED_LANGUAGES.map(lang => (
                                                                    <button
                                                                        key={lang.code}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSelectedLanguage(lang.code);
                                                                            setIsLangOpen(false);
                                                                        }}
                                                                        className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-between
                                                                            ${selectedLanguage === lang.code
                                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                                                            }`}
                                                                    >
                                                                        {lang.label}
                                                                        {selectedLanguage === lang.code && <CheckCircle2 size={14} className="text-emerald-500" />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                            {selectedLanguage !== 'en' && (
                                                <motion.span
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className="text-[10px] bg-emerald-500 text-white px-2.5 py-1 rounded-full font-black uppercase tracking-widest shadow-lg shadow-emerald-200"
                                                >
                                                    Translating
                                                </motion.span>
                                            )}
                                        </div>
                                        <div className="relative flex-grow flex flex-col">
                                            <Textarea
                                                value={issue}
                                                onChange={(e) => setIssue(e.target.value.substring(0, MAX_CHARS))}
                                                placeholder="Describe your problem. Example: VPN not connecting error 789"
                                                className="min-h-[160px] flex-grow rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white transition-all text-base p-4 resize-none"
                                                disabled={isLoading}
                                            />
                                        </div>
                                    </div>

                                    {supportsSpeech && (
                                        <div className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-6 shadow-sm">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl transition-colors duration-500 ${isListening ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-emerald-100 text-emerald-600'}`}>
                                                        <Mic size={20} className={isListening ? "animate-pulse" : ""} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-gray-900">Voice Assistant</h4>
                                                        <p className="text-xs text-gray-500 font-medium">{isListening ? "Listening to your voice..." : "Tap to describe via voice"}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={toggleMic}
                                                    className={`h-12 w-12 rounded-full flex items-center justify-center transition-all duration-500 border-none
                                                        ${isListening
                                                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200 scale-110'
                                                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-200'}`}
                                                >
                                                    {isListening ? <Volume2 className="animate-bounce" size={24} /> : <Mic size={24} />}
                                                </button>
                                            </div>

                                            <AnimatePresence>
                                                {isListening && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 40 }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="flex items-center justify-center gap-1.5 mb-2 overflow-hidden"
                                                    >
                                                        {[...Array(12)].map((_, i) => (
                                                            <motion.div
                                                                key={i}
                                                                animate={{
                                                                    height: [10, 30, 10],
                                                                    backgroundColor: ['#10b981', '#3b82f6', '#10b981']
                                                                }}
                                                                transition={{
                                                                    duration: 0.8,
                                                                    repeat: Infinity,
                                                                    delay: i * 0.05,
                                                                    ease: "easeInOut"
                                                                }}
                                                                className="w-1 rounded-full bg-emerald-500"
                                                            />
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {isListening && (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-emerald-50/50"
                                                >
                                                    <p className="text-sm text-emerald-800 font-medium italic">
                                                        "Speak clearly, our AI is transcribing..."
                                                    </p>
                                                </motion.div>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-gray-700">Screenshot (Optional)</label>

                                        <AnimatePresence mode="wait">
                                            {!imagePreview ? (
                                                <motion.div
                                                    key="dropzone"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    onDragOver={handleDragOver}
                                                    onDrop={handleDrop}
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="group relative h-40 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50 hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer flex flex-col items-center justify-center p-6"
                                                >
                                                    <input
                                                        type="file"
                                                        ref={fileInputRef}
                                                        onChange={handleFileChange}
                                                        accept="image/png, image/jpeg"
                                                        className="hidden"
                                                    />
                                                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                        <Upload className="text-emerald-500" size={20} />
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-600">Drag and drop or click to upload</p>
                                                    <p className="text-xs text-gray-400 mt-1">PNG or JPG up to 10MB</p>
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    key="preview"
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    className="relative rounded-2xl border border-gray-100 overflow-hidden bg-white p-4 items-center flex"
                                                >
                                                    <div className="flex items-center gap-4 w-full">
                                                        <div className="w-20 h-20 rounded-xl overflow-hidden border border-gray-50 shadow-inner shrink-0">
                                                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-gray-900 truncate">{file?.name}</p>
                                                            <p className="text-sm font-medium text-gray-600 mt-1">
                                                                {(file?.size / 1024 / 1024).toFixed(2)} MB
                                                                {isOcrLoading && " • Extracting text..."}
                                                                {!isOcrLoading && extractedOCR && " • Text extracted"}
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={removeFile}
                                                            className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full shrink-0 p-2"
                                                        >
                                                            <X size={18} />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {error && (
                                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm font-medium">
                                            <AlertCircle size={16} />
                                            {error}
                                        </div>
                                    )}

                                    <Button
                                        type="submit"
                                        disabled={isLoading || isOcrLoading || isTranslating || !issue.trim()}
                                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl h-14 font-bold text-base transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 group border-none"
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="animate-spin" size={20} />
                                                <span>{isTranslating ? "Translating..." : "Processing..."}</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Analyze Issue</span>
                                                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Voice Recording Modal overlay popup */}
                    <AnimatePresence>
                        {showVoiceModal && (
                            <motion.div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                <motion.div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl">
                                    <h3 className="text-lg font-bold mb-2">Voice Recording</h3>
                                    <p className="text-gray-600 text-sm mb-4">
                                        {voiceTranscript || interimVoice || "Listening..."}
                                    </p>
                                    <div className="flex justify-end gap-2">
                                        <Button type="button" variant="ghost" onClick={handleCancelVoice}>Cancel</Button>
                                        <Button type="button" className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={handleSaveVoice}>Save Text</Button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                </div>
            </main>
        </div>
    );
};

export default CreateTicket;
