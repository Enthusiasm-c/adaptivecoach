import React, { useState, useRef, useEffect } from 'react';
import { Image, X, ChevronUp, Sparkles, Video, Play, ThumbsUp, ThumbsDown, Save, Loader2, Check, ChevronDown } from 'lucide-react';

type LayoutVariant = 'A' | 'B' | 'C' | 'D';

// 25 уникальных упражнений из базы пользователей
const EXERCISES_FROM_DB = [
  '"Птица-собака" (Bird-Dog)',
  'Боковая планка',
  'Выпады с гантелями',
  'Жим в тренажере сидя (Грудь)',
  'Жим гантелей лежа на горизонтальной скамье',
  'Жим гантелей сидя',
  'Жим ногами в тренажере',
  'Жим штанги лежа',
  'Жим штанги на наклонной скамье',
  'Кардио: Ходьба на беговой дорожке под уклоном',
  'Махи гантелями в стороны стоя',
  'Подъем гантелей на бицепс',
  'Подъемы ног в висе',
  'Приседания с гантелью (Гоблет-приседания)',
  'Приседания со штангой',
  'Разведения гантелей в стороны стоя',
  'Разведения гантелей лежа на наклонной скамье',
  'Разгибание ног в тренажере сидя',
  'Румынская тяга с гантелями',
  'Сгибание ног в тренажере лежа',
  'Тяга верхнего блока к груди широким хватом',
  'Тяга верхнего блока широким хватом',
  'Тяга горизонтального блока к животу',
  'Тяга одной гантели в наклоне (Тяга гантели к поясу)',
  'Французский жим со штангой лежа',
];

interface ExerciseMedia {
  exerciseName: string;
  imageBase64?: string;
  videoUrl?: string;
  generatedAt: string;
  source: 'gemini' | 'veo' | 'manual';
  approved?: boolean;
  metrics?: {
    generationTimeMs: number;
    costEstimate: number;
    fileSize?: number;
  };
}

interface ExerciseMetadata {
  found: boolean;
  exerciseName: string;
  exerciseId?: string;
  equipment: string;
  equipmentId?: string | null;
  equipmentDescription: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
}

const ExerciseCardTest: React.FC = () => {
  const [variant, setVariant] = useState<LayoutVariant>('B');
  const [showImage, setShowImage] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

  // Exercise selection
  const [selectedExercise, setSelectedExercise] = useState(EXERCISES_FROM_DB[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Generation states
  const [imageSource, setImageSource] = useState<'svg' | 'ai' | 'video' | 'pair'>('svg');
  const [aiImageData, setAiImageData] = useState<string | null>(null);
  const [startImageData, setStartImageData] = useState<string | null>(null);
  const [endImageData, setEndImageData] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingPair, setIsGeneratingPair] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoOperationName, setVideoOperationName] = useState<string | null>(null);
  const [videoPollingStatus, setVideoPollingStatus] = useState<string>('');

  const [generationMetrics, setGenerationMetrics] = useState<{
    generationTimeMs: number;
    promptTokens?: number;
    totalTokens?: number;
    costEstimate: number;
    cached?: boolean;
    fileSize?: number;
  } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Video ref for autoplay test
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoAutoplayWorks, setVideoAutoplayWorks] = useState<boolean | null>(null);

  // localStorage cache
  const [cachedMedia, setCachedMedia] = useState<ExerciseMedia | null>(null);

  // Exercise metadata from API
  const [exerciseMetadata, setExerciseMetadata] = useState<ExerciseMetadata | null>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);

  // Fetch exercise metadata on exercise change
  useEffect(() => {
    const fetchMetadata = async () => {
      setIsLoadingMetadata(true);
      try {
        const response = await fetch(
          `https://api.sensei.training/api/exercises/metadata?name=${encodeURIComponent(selectedExercise)}`,
          {
            headers: {
              'x-api-key': '9a361ff33289e0723fad20cbf91b263a6cea0d7cf29c44fe7bbe59dd91d2a50d'
            }
          }
        );
        const data = await response.json();
        setExerciseMetadata(data);
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
        setExerciseMetadata(null);
      } finally {
        setIsLoadingMetadata(false);
      }
    };

    fetchMetadata();
  }, [selectedExercise]);

  // Load from cache on exercise change
  useEffect(() => {
    const cacheKey = `exercise_media_${encodeURIComponent(selectedExercise)}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const media = JSON.parse(cached) as ExerciseMedia;
      setCachedMedia(media);
      if (media.imageBase64) {
        setAiImageData(media.imageBase64);
        setImageSource('ai');
      }
      if (media.videoUrl) {
        setVideoUrl(media.videoUrl);
      }
      setGenerationMetrics(media.metrics || null);
    } else {
      setCachedMedia(null);
      setAiImageData(null);
      setVideoUrl(null);
      setGenerationMetrics(null);
      setImageSource('svg');
    }
    setGenerationError(null);
  }, [selectedExercise]);

  // Test video autoplay capability
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      const video = videoRef.current;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setVideoAutoplayWorks(true);
          })
          .catch(() => {
            setVideoAutoplayWorks(false);
          });
      }
    }
  }, [videoUrl]);

  // Poll for video generation status
  useEffect(() => {
    if (!videoOperationName) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `https://api.sensei.training/api/videos/status/${videoOperationName}`,
          {
            headers: {
              'x-api-key': '9a361ff33289e0723fad20cbf91b263a6cea0d7cf29c44fe7bbe59dd91d2a50d'
            }
          }
        );
        const data = await response.json();

        if (data.done) {
          clearInterval(pollInterval);
          setVideoOperationName(null);
          setIsGeneratingVideo(false);

          if (data.video?.downloadUrl) {
            setVideoUrl(data.video.downloadUrl);
            setVideoPollingStatus('✅ Видео готово!');
            setImageSource('video');
          } else {
            setGenerationError('Видео сгенерировано, но URL недоступен');
            setVideoPollingStatus('❌ Ошибка получения URL');
          }
        } else {
          setVideoPollingStatus(`⏳ Генерация... ${data.message || ''}`);
        }
      } catch (error) {
        console.error('Polling error:', error);
        setVideoPollingStatus('❌ Ошибка polling');
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [videoOperationName]);

  // Generate image via Gemini 3 Pro
  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    setGenerationError(null);
    const startTime = Date.now();

    try {
      const response = await fetch('https://api.sensei.training/api/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': '9a361ff33289e0723fad20cbf91b263a6cea0d7cf29c44fe7bbe59dd91d2a50d'
        },
        body: JSON.stringify({
          exerciseName: selectedExercise
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();

      if (data.success) {
        setAiImageData(data.imageBase64);
        const fileSize = Math.round((data.imageBase64.length * 3) / 4 / 1024); // Base64 to KB
        setGenerationMetrics({
          ...data.metrics,
          cached: data.cached,
          fileSize
        });
        setImageSource('ai');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Generate START + END image pair via Gemini
  const handleGeneratePair = async () => {
    setIsGeneratingPair(true);
    setGenerationError(null);

    try {
      const response = await fetch('https://api.sensei.training/api/images/generate-pair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': '9a361ff33289e0723fad20cbf91b263a6cea0d7cf29c44fe7bbe59dd91d2a50d'
        },
        body: JSON.stringify({
          exerciseName: selectedExercise
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate image pair');
      }

      const data = await response.json();

      if (data.success) {
        setStartImageData(data.startImage);
        setEndImageData(data.endImage);
        setAiImageData(data.startImage); // Use start image as main
        setGenerationMetrics({
          ...data.metrics,
          cached: false
        });
        setImageSource('pair');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate pair');
    } finally {
      setIsGeneratingPair(false);
    }
  };

  // Generate video via Veo (image-to-video)
  const handleGenerateVideo = async () => {
    const imageToUse = startImageData || aiImageData;
    if (!imageToUse) {
      setGenerationError('Сначала сгенерируйте изображение');
      return;
    }

    setIsGeneratingVideo(true);
    setGenerationError(null);
    setVideoPollingStatus('🚀 Запуск генерации видео (image-to-video)...');

    try {
      const response = await fetch('https://api.sensei.training/api/videos/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': '9a361ff33289e0723fad20cbf91b263a6cea0d7cf29c44fe7bbe59dd91d2a50d'
        },
        body: JSON.stringify({
          exerciseName: selectedExercise,
          startImage: startImageData || aiImageData,
          endImage: endImageData || undefined
        })
      });

      const data = await response.json();

      if (data.success && data.operationName) {
        setVideoOperationName(data.operationName);
        setVideoPollingStatus(`⏳ Операция: ${data.operationName}`);
      } else {
        throw new Error(data.error || 'Failed to start video generation');
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate video');
      setIsGeneratingVideo(false);
      setVideoPollingStatus('');
    }
  };

  // Generate video directly from text (text-to-video) via Veo 3.1
  const handleGenerateVideoFromText = async () => {
    setIsGeneratingVideo(true);
    setGenerationError(null);
    setVideoPollingStatus('🚀 Запуск text-to-video генерации (Veo 3.1)...');

    try {
      const response = await fetch('https://api.sensei.training/api/videos/generate-from-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': '9a361ff33289e0723fad20cbf91b263a6cea0d7cf29c44fe7bbe59dd91d2a50d'
        },
        body: JSON.stringify({
          exerciseName: selectedExercise
        })
      });

      const data = await response.json();

      if (data.success && data.operationName) {
        setVideoOperationName(data.operationName);
        setVideoPollingStatus(`⏳ Text-to-video: ${data.operationName}`);
      } else {
        throw new Error(data.error || 'Failed to start text-to-video generation');
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate video from text');
      setIsGeneratingVideo(false);
      setVideoPollingStatus('');
    }
  };

  // Save to cache
  const handleSaveToCache = (approved: boolean) => {
    const media: ExerciseMedia = {
      exerciseName: selectedExercise,
      imageBase64: aiImageData || undefined,
      videoUrl: videoUrl || undefined,
      generatedAt: new Date().toISOString(),
      source: videoUrl ? 'veo' : 'gemini',
      approved,
      metrics: generationMetrics || undefined
    };

    const cacheKey = `exercise_media_${encodeURIComponent(selectedExercise)}`;
    localStorage.setItem(cacheKey, JSON.stringify(media));
    setCachedMedia(media);
  };

  // Clear cache for current exercise
  const handleClearCache = () => {
    const cacheKey = `exercise_media_${encodeURIComponent(selectedExercise)}`;
    localStorage.removeItem(cacheKey);
    setCachedMedia(null);
    setAiImageData(null);
    setVideoUrl(null);
    setGenerationMetrics(null);
    setImageSource('svg');
  };

  // SVG Split-screen exercise demonstration component
  const SplitScreenDemo = () => (
    <svg viewBox="0 0 800 450" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="450" fill="#1a1a1a" />
      <line x1="400" y1="0" x2="400" y2="450" stroke="#4a4a4a" strokeWidth="3" strokeDasharray="10,5" />
      <rect x="20" y="20" width="160" height="40" fill="#6366f1" rx="8" />
      <text x="100" y="46" fill="white" fontSize="16" fontWeight="bold" textAnchor="middle">ИСХОДНОЕ</text>
      <rect x="620" y="20" width="160" height="40" fill="#10b981" rx="8" />
      <text x="700" y="46" fill="white" fontSize="16" fontWeight="bold" textAnchor="middle">ФИНАЛЬНОЕ</text>
      <g>
        <circle cx="200" cy="150" r="20" fill="none" stroke="white" strokeWidth="4" />
        <line x1="200" y1="170" x2="200" y2="250" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="150" y1="190" x2="250" y2="190" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="140" y1="190" x2="260" y2="190" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" />
        <line x1="200" y1="250" x2="180" y2="330" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="200" y1="250" x2="220" y2="330" stroke="white" strokeWidth="4" strokeLinecap="round" />
      </g>
      <g>
        <circle cx="600" cy="140" r="20" fill="none" stroke="white" strokeWidth="4" />
        <line x1="600" y1="160" x2="590" y2="230" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="550" y1="180" x2="650" y2="180" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="540" y1="180" x2="660" y2="180" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" />
        <line x1="590" y1="230" x2="560" y2="280" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="590" y1="230" x2="620" y2="280" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="560" y1="280" x2="560" y2="330" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="620" y1="280" x2="620" y2="330" stroke="white" strokeWidth="4" strokeLinecap="round" />
      </g>
      <text x="400" y="420" fill="#9ca3af" fontSize="14" textAnchor="middle">{selectedExercise}</text>
    </svg>
  );

  // Render media content
  const renderMedia = (className = '') => {
    // Video
    if (imageSource === 'video' && videoUrl) {
      return (
        <div className={`relative w-full overflow-hidden rounded-xl bg-black ${className}`}>
          <video
            ref={videoRef}
            src={videoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-auto"
          />
          {videoAutoplayWorks === false && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <button
                onClick={() => videoRef.current?.play()}
                className="p-4 bg-white/20 rounded-full"
              >
                <Play size={32} className="text-white" />
              </button>
            </div>
          )}
        </div>
      );
    }

    // Image Pair (START + END)
    if (imageSource === 'pair' && startImageData && endImageData) {
      return (
        <div className={`relative w-full overflow-hidden rounded-xl bg-black ${className}`}>
          <div className="grid grid-cols-2 gap-1">
            <img src={startImageData} alt="START" className="w-full h-auto" />
            <img src={endImageData} alt="END" className="w-full h-auto" />
          </div>
        </div>
      );
    }

    // AI Image
    if (imageSource === 'ai' && aiImageData) {
      return (
        <div className={`relative w-full overflow-hidden rounded-xl bg-black ${className}`}>
          <img
            src={aiImageData}
            alt={selectedExercise}
            className="w-full h-auto"
          />
        </div>
      );
    }

    // SVG demo
    return (
      <div className={`relative w-full overflow-hidden rounded-xl bg-neutral-800 ${className}`}>
        <SplitScreenDemo />
      </div>
    );
  };

  // Variant B: Collapsed + expand button (recommended)
  const renderPreviewCard = () => (
    <div className="bg-neutral-900 rounded-2xl p-5 border border-white/10 space-y-4">
      <h3 className="text-lg font-bold text-white">🏋️ {selectedExercise}</h3>

      <button
        onClick={() => setShowImage(!showImage)}
        className="flex items-center gap-2 text-sm font-medium text-indigo-400 bg-indigo-500/10 px-4 py-2 rounded-lg hover:bg-indigo-500/20 transition"
      >
        {imageSource === 'video' ? <Video size={16} /> : <Image size={16} />}
        {showImage ? 'Скрыть технику' : 'Показать технику'}
      </button>

      {showImage && (
        <div className="animate-fade-in">
          {renderMedia()}

          {/* Autoplay status */}
          {imageSource === 'video' && (
            <div className={`mt-2 text-xs ${videoAutoplayWorks ? 'text-green-400' : 'text-yellow-400'}`}>
              {videoAutoplayWorks === null && '⏳ Проверка autoplay...'}
              {videoAutoplayWorks === true && '✅ Autoplay работает!'}
              {videoAutoplayWorks === false && '⚠️ Autoplay заблокирован, нужен клик'}
            </div>
          )}
        </div>
      )}

      <div className="text-sm text-gray-500">3 подхода × 8-12 повторений</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-2xl font-black">🧪 Песочница генерации</h1>
          <p className="text-sm text-gray-500">Тестирование AI генерации техники упражнений</p>
        </div>

        {/* Exercise Selector */}
        <div className="bg-neutral-900 rounded-2xl p-5 border border-white/10 space-y-4">
          <label className="block text-xs font-bold text-gray-500 uppercase">Упражнение ({EXERCISES_FROM_DB.indexOf(selectedExercise) + 1}/{EXERCISES_FROM_DB.length})</label>

          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center justify-between p-3 bg-neutral-800 rounded-lg text-left"
            >
              <span className="text-white truncate pr-2">{selectedExercise}</span>
              <ChevronDown size={20} className={`text-gray-400 transition ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute z-50 w-full mt-2 max-h-60 overflow-y-auto bg-neutral-800 rounded-lg border border-white/10 shadow-xl">
                {EXERCISES_FROM_DB.map((ex, i) => (
                  <button
                    key={ex}
                    onClick={() => {
                      setSelectedExercise(ex);
                      setDropdownOpen(false);
                      setShowImage(false);
                    }}
                    className={`w-full flex items-center gap-2 p-3 text-left text-sm hover:bg-neutral-700 transition ${
                      ex === selectedExercise ? 'bg-indigo-600/20 text-indigo-300' : 'text-gray-300'
                    }`}
                  >
                    <span className="text-gray-500 w-6">{i + 1}.</span>
                    <span className="truncate">{ex}</span>
                    {localStorage.getItem(`exercise_media_${encodeURIComponent(ex)}`) && (
                      <Check size={14} className="text-green-400 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cache Status */}
          {cachedMedia && (
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2 py-1 rounded ${cachedMedia.approved ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {cachedMedia.approved ? '✅ Одобрено' : '⏳ На проверке'}
              </span>
              <span className="text-gray-500">
                {new Date(cachedMedia.generatedAt).toLocaleDateString('ru-RU')}
              </span>
              <button onClick={handleClearCache} className="ml-auto text-amber-400 hover:text-amber-300">
                Очистить
              </button>
            </div>
          )}

          {/* Exercise Metadata */}
          {isLoadingMetadata ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={12} className="animate-spin" />
              Загрузка метаданных...
            </div>
          ) : exerciseMetadata && (
            <div className="p-3 bg-neutral-800 rounded-lg text-xs space-y-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${exerciseMetadata.found ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                  {exerciseMetadata.found ? '✓ В базе' : '⚠ Не найдено'}
                </span>
                <span className="text-gray-400">{exerciseMetadata.equipment}</span>
              </div>
              <div className="text-gray-500">
                <span className="text-purple-400">{exerciseMetadata.primaryMuscle}</span>
                {exerciseMetadata.secondaryMuscles.length > 0 && (
                  <span> + {exerciseMetadata.secondaryMuscles.join(', ')}</span>
                )}
              </div>
              {exerciseMetadata.found && (
                <div className="text-[10px] text-gray-600 italic truncate">
                  🏋️ {exerciseMetadata.equipmentDescription}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Generation Controls */}
        <div className="bg-neutral-900 rounded-2xl p-5 border border-white/10 space-y-4">
          <label className="block text-xs font-bold text-gray-500 uppercase">Генерация</label>

          {/* Generate Image Button */}
          <button
            onClick={handleGenerateImage}
            disabled={isGeneratingImage || isGeneratingPair}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold hover:from-indigo-700 hover:to-purple-700 transition disabled:opacity-50"
          >
            {isGeneratingImage ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Генерация фото...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                1 фото (Gemini) ~$0.13
              </>
            )}
          </button>

          {/* Generate Pair Button - NEW */}
          <button
            onClick={handleGeneratePair}
            disabled={isGeneratingPair || isGeneratingImage}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg font-bold hover:from-amber-700 hover:to-orange-700 transition disabled:opacity-50"
          >
            {isGeneratingPair ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Генерация START + END...
              </>
            ) : (
              <>
                <Image size={16} />
                START + END пара ~$0.27
              </>
            )}
          </button>

          {/* Pair status */}
          {startImageData && endImageData && (
            <p className="text-xs text-center text-green-400">✅ Пара изображений готова (START + END)</p>
          )}

          {/* Generate Video Button (image-to-video) */}
          <button
            onClick={handleGenerateVideo}
            disabled={isGeneratingVideo || (!aiImageData && !startImageData)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg font-bold hover:from-violet-700 hover:to-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingVideo ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {videoPollingStatus}
              </>
            ) : (
              <>
                <Video size={16} />
                Видео из картинки ~$1.20 {(!aiImageData && !startImageData) && '⚠️'}
              </>
            )}
          </button>

          {/* Generate Video from Text Button (text-to-video) */}
          <button
            onClick={handleGenerateVideoFromText}
            disabled={isGeneratingVideo}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGeneratingVideo ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {videoPollingStatus}
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Text-to-Video (Veo 3.1) ~$1.20
              </>
            )}
          </button>

          {/* Polling Status */}
          {videoPollingStatus && !isGeneratingVideo && (
            <p className="text-xs text-center text-gray-400">{videoPollingStatus}</p>
          )}

          {/* Error */}
          {generationError && (
            <p className="text-xs text-amber-400 text-center">❌ {generationError}</p>
          )}

          {/* Metrics */}
          {generationMetrics && (
            <div className="p-3 bg-neutral-800 rounded-lg text-xs space-y-1">
              <p className="font-bold text-white">📊 Метрики:</p>
              {generationMetrics.cached && <p className="text-green-400">📦 Из кеша</p>}
              <p className="text-gray-400">⏱️ Время: {generationMetrics.generationTimeMs}ms</p>
              <p className="text-gray-400">💰 Стоимость: ${generationMetrics.costEstimate?.toFixed(4) || '?'}</p>
              {generationMetrics.fileSize && (
                <p className="text-gray-400">📁 Размер: {generationMetrics.fileSize}KB</p>
              )}
            </div>
          )}
        </div>

        {/* Approval Buttons */}
        {(aiImageData || videoUrl) && (
          <div className="bg-neutral-900 rounded-2xl p-5 border border-white/10 space-y-4">
            <label className="block text-xs font-bold text-gray-500 uppercase">Оценка качества</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSaveToCache(true)}
                className="flex items-center justify-center gap-2 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition"
              >
                <ThumbsUp size={16} />
                Одобрить
              </button>
              <button
                onClick={() => handleSaveToCache(false)}
                className="flex items-center justify-center gap-2 py-3 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 transition"
              >
                <ThumbsDown size={16} />
                На доработку
              </button>
            </div>
          </div>
        )}

        {/* Source Toggle */}
        <div className="bg-neutral-900 rounded-2xl p-5 border border-white/10 space-y-4">
          <label className="block text-xs font-bold text-gray-500 uppercase">Источник</label>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setImageSource('svg')}
              className={`py-2 rounded-lg font-bold text-xs transition ${
                imageSource === 'svg' ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-gray-400'
              }`}
            >
              SVG
            </button>
            <button
              onClick={() => setImageSource('ai')}
              disabled={!aiImageData}
              className={`py-2 rounded-lg font-bold text-xs transition disabled:opacity-50 ${
                imageSource === 'ai' ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-gray-400'
              }`}
            >
              Фото
            </button>
            <button
              onClick={() => setImageSource('pair')}
              disabled={!startImageData || !endImageData}
              className={`py-2 rounded-lg font-bold text-xs transition disabled:opacity-50 ${
                imageSource === 'pair' ? 'bg-amber-600 text-white' : 'bg-neutral-800 text-gray-400'
              }`}
            >
              Пара
            </button>
            <button
              onClick={() => setImageSource('video')}
              disabled={!videoUrl}
              className={`py-2 rounded-lg font-bold text-xs transition disabled:opacity-50 ${
                imageSource === 'video' ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-gray-400'
              }`}
            >
              Видео
            </button>
          </div>
        </div>

        {/* Preview Card */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase">Preview</label>
          {renderPreviewCard()}
        </div>

        {/* Notes */}
        <div className="bg-neutral-900/50 border border-white/5 rounded-xl p-4 text-xs text-gray-500 space-y-2">
          <p className="font-bold text-gray-400">📝 Как использовать:</p>
          <ol className="space-y-1 list-decimal list-inside">
            <li>Выберите упражнение из dropdown</li>
            <li>Нажмите "Генерировать фото" (Gemini, ~$0.13)</li>
            <li>Оцените качество 👍/👎</li>
            <li>Если ОК → "Генерировать видео" (Veo, ~$1.40)</li>
            <li>Проверьте autoplay в Telegram</li>
          </ol>

          <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="font-bold text-yellow-400">⚠️ Video autoplay требует:</p>
            <code className="text-yellow-300 text-[10px] block mt-1">
              {'<video autoplay loop muted playsinline>'}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseCardTest;
