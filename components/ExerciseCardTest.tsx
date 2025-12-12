import React, { useState } from 'react';
import { Image, X, ChevronUp, Sparkles } from 'lucide-react';

type LayoutVariant = 'A' | 'B' | 'C' | 'D';
type AspectRatio = '16:9' | '1:1' | '4:3';

const ExerciseCardTest: React.FC = () => {
  const [variant, setVariant] = useState<LayoutVariant>('B'); // Default to B since user liked it
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [showImage, setShowImage] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);

  // AI Image Generation states
  const [imageSource, setImageSource] = useState<'svg' | 'ai'>('svg');
  const [aiImageData, setAiImageData] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMetrics, setGenerationMetrics] = useState<{
    generationTimeMs: number;
    promptTokens: number;
    totalTokens: number;
    costEstimate: number;
    cached: boolean;
  } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Mock data
  const mockExercise = {
    name: "High Bar Squat",
    sets: 3,
    reps: "3-5",
    weight: 45,
    rest: 180,
    description: "Штанга на плечах, ноги на ширине плеч. Приседайте до параллели или ниже. Держите спину прямой, колени над носками.",
    imageUrl: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&h=450&fit=crop", // Will be replaced with canvas
    history: [
      { date: "2024-01-10", sets: [{ weight: 40, reps: 5 }, { weight: 45, reps: 5 }] },
      { date: "2024-01-07", sets: [{ weight: 40, reps: 6 }, { weight: 45, reps: 4 }] }
    ]
  };

  // Handle AI image generation
  const handleGenerateAIImage = async () => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const response = await fetch('https://api.sensei.training/api/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': '9a361ff33289e0723fad20cbf91b263a6cea0d7cf29c44fe7bbe59dd91d2a50d'
        },
        body: JSON.stringify({
          exerciseName: mockExercise.name
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();

      if (data.success) {
        setAiImageData(data.imageBase64);
        setGenerationMetrics({
          ...data.metrics,
          cached: data.cached
        });
        setImageSource('ai'); // Switch to AI image automatically
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate image');
      console.error('Image generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // SVG Split-screen exercise demonstration component
  const SplitScreenDemo = () => (
    <svg viewBox="0 0 800 450" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
      {/* Background */}
      <rect width="800" height="450" fill="#1a1a1a" />

      {/* Split line */}
      <line x1="400" y1="0" x2="400" y2="450" stroke="#4a4a4a" strokeWidth="3" strokeDasharray="10,5" />

      {/* Left label - Starting position */}
      <rect x="20" y="20" width="160" height="40" fill="#6366f1" rx="8" />
      <text x="100" y="46" fill="white" fontSize="16" fontWeight="bold" textAnchor="middle">ИСХОДНОЕ</text>

      {/* Right label - Final position */}
      <rect x="620" y="20" width="160" height="40" fill="#10b981" rx="8" />
      <text x="700" y="46" fill="white" fontSize="16" fontWeight="bold" textAnchor="middle">ФИНАЛЬНОЕ</text>

      {/* Starting position - Standing figure */}
      <g>
        {/* Head */}
        <circle cx="200" cy="150" r="20" fill="none" stroke="white" strokeWidth="4" />
        {/* Body */}
        <line x1="200" y1="170" x2="200" y2="250" stroke="white" strokeWidth="4" strokeLinecap="round" />
        {/* Arms */}
        <line x1="150" y1="190" x2="250" y2="190" stroke="white" strokeWidth="4" strokeLinecap="round" />
        {/* Barbell */}
        <line x1="140" y1="190" x2="260" y2="190" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" />
        {/* Legs */}
        <line x1="200" y1="250" x2="180" y2="330" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="200" y1="250" x2="220" y2="330" stroke="white" strokeWidth="4" strokeLinecap="round" />
      </g>

      {/* Final position - Squatting figure */}
      <g>
        {/* Head */}
        <circle cx="600" cy="140" r="20" fill="none" stroke="white" strokeWidth="4" />
        {/* Body */}
        <line x1="600" y1="160" x2="590" y2="230" stroke="white" strokeWidth="4" strokeLinecap="round" />
        {/* Arms */}
        <line x1="550" y1="180" x2="650" y2="180" stroke="white" strokeWidth="4" strokeLinecap="round" />
        {/* Barbell */}
        <line x1="540" y1="180" x2="660" y2="180" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" />
        {/* Upper legs */}
        <line x1="590" y1="230" x2="560" y2="280" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="590" y1="230" x2="620" y2="280" stroke="white" strokeWidth="4" strokeLinecap="round" />
        {/* Lower legs */}
        <line x1="560" y1="280" x2="560" y2="330" stroke="white" strokeWidth="4" strokeLinecap="round" />
        <line x1="620" y1="280" x2="620" y2="330" stroke="white" strokeWidth="4" strokeLinecap="round" />
      </g>

      {/* Arrows showing movement - Red */}
      <defs>
        <marker id="arrowRed" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#ef4444" />
        </marker>
        <marker id="arrowGreen" markerWidth="12" markerHeight="12" refX="11" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L11,3 z" fill="#10b981" />
        </marker>
      </defs>

      {/* Movement arrows on left side */}
      <line x1="200" y1="260" x2="200" y2="310" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <line x1="190" y1="280" x2="160" y2="280" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrowRed)" />
      <line x1="180" y1="320" x2="165" y2="335" stroke="#ef4444" strokeWidth="3" markerEnd="url(#arrowRed)" />

      {/* Central arrow */}
      <line x1="320" y1="225" x2="480" y2="225" stroke="#10b981" strokeWidth="4" markerEnd="url(#arrowGreen)" />
      <text x="400" y="215" fill="#10b981" fontSize="18" fontWeight="bold" textAnchor="middle">ДВИЖЕНИЕ</text>

      {/* Key points text */}
      <text x="100" y="380" fill="#9ca3af" fontSize="14">Спина прямая</text>
      <text x="80" y="400" fill="#9ca3af" fontSize="14">Колени над носками</text>
      <text x="520" y="380" fill="#9ca3af" fontSize="14">Бедра параллельно</text>
      <text x="560" y="400" fill="#9ca3af" fontSize="14">Таз назад</text>
    </svg>
  );

  // Calculate padding for aspect ratio
  const getAspectPadding = () => {
    switch (aspectRatio) {
      case '16:9': return '56.25%';
      case '1:1': return '100%';
      case '4:3': return '75%';
    }
  };

  // Render image with proper aspect ratio - using SVG for split-screen demo or AI generated
  const renderImage = (className = '') => {
    if (imageSource === 'ai' && aiImageData) {
      return (
        <div className={`relative w-full overflow-hidden rounded-xl bg-black ${className}`}>
          <img
            src={aiImageData}
            alt={mockExercise.name}
            className="w-full h-auto"
            style={{
              mixBlendMode: 'screen',
              maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)'
            }}
          />
        </div>
      );
    }

    // Default SVG demo
    return (
      <div className={`relative w-full overflow-hidden rounded-xl bg-neutral-800 ${className}`}>
        <SplitScreenDemo />
      </div>
    );
  };

  // Variant A: Image always visible after title
  const renderVariantA = () => (
    <div className="bg-neutral-900 rounded-2xl p-5 border border-white/10 space-y-4">
      {/* Exercise Name */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">🏋️ {mockExercise.name}</h3>
      </div>

      {/* Image - Always visible */}
      {renderImage('animate-fade-in')}

      {/* Description */}
      <p className="text-sm text-gray-400 leading-relaxed">
        {mockExercise.description}
      </p>

      {/* Sets Info */}
      <div className="text-sm text-gray-500">
        {mockExercise.sets} sets × {mockExercise.reps} reps
      </div>

      {/* Mock Sets */}
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-neutral-800 rounded-xl">
            <span className="text-gray-500 text-sm">#{i + 1}</span>
            <input
              type="number"
              placeholder="45"
              className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-white text-sm text-center"
            />
            <span className="text-gray-600 text-xs">кг</span>
            <input
              type="number"
              placeholder="5"
              className="w-16 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-white text-sm text-center"
            />
            <span className="text-gray-600 text-xs">повт</span>
          </div>
        ))}
      </div>
    </div>
  );

  // Variant B: Collapsed + expand button
  const renderVariantB = () => (
    <div className="bg-neutral-900 rounded-2xl p-5 border border-white/10 space-y-4">
      {/* Exercise Name */}
      <h3 className="text-lg font-bold text-white">🏋️ {mockExercise.name}</h3>

      {/* Sets Info */}
      <div className="text-sm text-gray-500">
        {mockExercise.sets} sets × {mockExercise.reps} reps
      </div>

      {/* Show Technique Button */}
      <button
        onClick={() => setShowImage(!showImage)}
        className="flex items-center gap-2 text-sm font-medium text-indigo-400 bg-indigo-500/10 px-4 py-2 rounded-lg hover:bg-indigo-500/20 transition"
      >
        <Image size={16} />
        {showImage ? 'Скрыть технику' : 'Показать технику'}
      </button>

      {/* Expandable Image */}
      {showImage && (
        <div className="animate-fade-in">
          {renderImage()}
          <p className="text-sm text-gray-400 mt-3 leading-relaxed">
            {mockExercise.description}
          </p>
        </div>
      )}

      {/* Mock Sets */}
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-neutral-800 rounded-xl">
            <span className="text-gray-500 text-sm">#{i + 1}</span>
            <input
              type="number"
              placeholder="45"
              className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-white text-sm text-center"
            />
            <span className="text-gray-600 text-xs">кг</span>
            <input
              type="number"
              placeholder="5"
              className="w-16 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-white text-sm text-center"
            />
            <span className="text-gray-600 text-xs">повт</span>
          </div>
        ))}
      </div>
    </div>
  );

  // Variant C: Thumbnail + Full screen modal
  const renderVariantC = () => (
    <>
      <div className="bg-neutral-900 rounded-2xl p-5 border border-white/10 space-y-4">
        {/* Exercise Name with preview */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-white flex-1">🏋️ {mockExercise.name}</h3>
          <button
            onClick={() => setFullScreenImage(true)}
            className="flex-shrink-0"
          >
            {renderImage('w-16 h-16 cursor-pointer hover:opacity-80 transition')}
          </button>
        </div>

        {/* Sets Info */}
        <div className="text-sm text-gray-500">
          {mockExercise.sets} sets × {mockExercise.reps} reps
        </div>

        {/* Mock Sets */}
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-neutral-800 rounded-xl">
              <span className="text-gray-500 text-sm">#{i + 1}</span>
              <input
                type="number"
                placeholder="45"
                className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-white text-sm text-center"
              />
              <span className="text-gray-600 text-xs">кг</span>
              <input
                type="number"
                placeholder="5"
                className="w-16 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-white text-sm text-center"
              />
              <span className="text-gray-600 text-xs">повт</span>
            </div>
          ))}
        </div>
      </div>

      {/* Full Screen Modal */}
      {fullScreenImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 animate-fade-in">
          <button
            onClick={() => setFullScreenImage(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition"
          >
            <X size={24} />
          </button>
          <div className="max-w-2xl w-full">
            {renderImage()}
            <p className="text-white mt-6 text-center leading-relaxed">
              {mockExercise.description}
            </p>
          </div>
        </div>
      )}
    </>
  );

  // Variant D: Bottom Sheet
  const renderVariantD = () => (
    <>
      <div className="bg-neutral-900 rounded-2xl p-5 border border-white/10 space-y-4">
        {/* Exercise Name */}
        <h3 className="text-lg font-bold text-white">🏋️ {mockExercise.name}</h3>

        {/* Sets Info */}
        <div className="text-sm text-gray-500">
          {mockExercise.sets} sets × {mockExercise.reps} reps
        </div>

        {/* Mock Sets */}
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-neutral-800 rounded-xl">
              <span className="text-gray-500 text-sm">#{i + 1}</span>
              <input
                type="number"
                placeholder="45"
                className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-white text-sm text-center"
              />
              <span className="text-gray-600 text-xs">кг</span>
              <input
                type="number"
                placeholder="5"
                className="w-16 bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1 text-white text-sm text-center"
              />
              <span className="text-gray-600 text-xs">повт</span>
            </div>
          ))}
        </div>

        {/* Swipe up hint */}
        <button
          onClick={() => setBottomSheetOpen(true)}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition py-2"
        >
          <ChevronUp size={16} />
          Свайп вверх для техники
        </button>
      </div>

      {/* Bottom Sheet */}
      {bottomSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={() => setBottomSheetOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-neutral-900 rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-6" />

            {/* Close button */}
            <button
              onClick={() => setBottomSheetOpen(false)}
              className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-gray-400 hover:text-white transition"
            >
              <X size={20} />
            </button>

            <h3 className="text-xl font-bold text-white mb-4">{mockExercise.name}</h3>

            {renderImage('mb-4')}

            <div className="space-y-3 text-gray-300">
              <h4 className="font-bold text-white">Описание техники:</h4>
              <p className="leading-relaxed">{mockExercise.description}</p>

              <h4 className="font-bold text-white mt-4">Ключевые моменты:</h4>
              <ul className="space-y-2 text-sm">
                <li>• Штанга на плечах, ноги на ширине плеч</li>
                <li>• Приседайте до параллели или ниже</li>
                <li>• Держите спину прямой, колени над носками</li>
                <li>• Таз назад, грудь вперёд</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-2xl font-black">🧪 Exercise Card UI Test</h1>
          <p className="text-sm text-gray-500">Тестирование вариантов размещения изображений</p>
        </div>

        {/* Controls */}
        <div className="bg-neutral-900 rounded-2xl p-5 border border-white/10 space-y-5">
          {/* Layout Variant Tabs */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Layout Variant</label>
            <div className="grid grid-cols-4 gap-2">
              {(['A', 'B', 'C', 'D'] as LayoutVariant[]).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setVariant(v);
                    setShowImage(false);
                    setFullScreenImage(false);
                    setBottomSheetOpen(false);
                  }}
                  className={`py-2 rounded-lg font-bold text-sm transition ${
                    variant === v
                      ? 'bg-indigo-600 text-white'
                      : 'bg-neutral-800 text-gray-400 hover:bg-neutral-700'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              {variant === 'A' && 'A: Изображение всегда видно'}
              {variant === 'B' && 'B: Кнопка "Показать технику"'}
              {variant === 'C' && 'C: Thumbnail + Full Screen'}
              {variant === 'D' && 'D: Bottom Sheet (свайп вверх)'}
            </p>
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Aspect Ratio</label>
            <div className="grid grid-cols-3 gap-2">
              {(['16:9', '1:1', '4:3'] as AspectRatio[]).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`py-2 rounded-lg font-mono text-sm transition ${
                    aspectRatio === ratio
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-800 text-gray-400 hover:bg-neutral-700'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Image Source Toggle */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Image Source</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setImageSource('svg')}
                className={`py-2 rounded-lg font-bold text-sm transition ${
                  imageSource === 'svg'
                    ? 'bg-purple-600 text-white'
                    : 'bg-neutral-800 text-gray-400 hover:bg-neutral-700'
                }`}
              >
                SVG Demo
              </button>
              <button
                onClick={() => setImageSource('ai')}
                disabled={!aiImageData}
                className={`py-2 rounded-lg font-bold text-sm transition ${
                  imageSource === 'ai'
                    ? 'bg-purple-600 text-white'
                    : 'bg-neutral-800 text-gray-400 hover:bg-neutral-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                AI Generated
              </button>
            </div>
          </div>

          {/* AI Generation Button */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">AI Image Generation (Nano Banana Pro)</label>
            <button
              onClick={handleGenerateAIImage}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-bold hover:from-indigo-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate AI Image
                </>
              )}
            </button>

            {generationError && (
              <p className="text-xs text-red-400 mt-2">❌ {generationError}</p>
            )}

            {generationMetrics && (
              <div className="mt-3 p-3 bg-neutral-800 rounded-lg text-xs space-y-1">
                <p className="font-bold text-white">📊 Generation Metrics:</p>
                <p className="text-gray-400">
                  {generationMetrics.cached ? '📦 Loaded from cache' : '✨ Freshly generated'}
                </p>
                <p className="text-gray-400">⏱️ Time: {generationMetrics.generationTimeMs}ms</p>
                <p className="text-gray-400">🔢 Tokens: {generationMetrics.promptTokens} prompt / {generationMetrics.totalTokens} total</p>
                <p className="text-gray-400">💰 Cost: ${generationMetrics.costEstimate.toFixed(4)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Preview Card */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-500 uppercase">Preview</label>
          {variant === 'A' && renderVariantA()}
          {variant === 'B' && renderVariantB()}
          {variant === 'C' && renderVariantC()}
          {variant === 'D' && renderVariantD()}
        </div>

        {/* Notes */}
        <div className="bg-neutral-900/50 border border-white/5 rounded-xl p-4 text-xs text-gray-500 space-y-2">
          <p className="font-bold text-gray-400">📝 Заметки:</p>
          <ul className="space-y-1">
            <li><strong>Вариант A:</strong> Максимальная наглядность, подходит для новичков</li>
            <li><strong>Вариант B:</strong> ✅ Экономит место, загрузка по требованию (Рекомендован!)</li>
            <li><strong>Вариант C:</strong> Компактный preview + детальный просмотр</li>
            <li><strong>Вариант D:</strong> Mobile-native паттерн, максимум информации</li>
          </ul>
          <div className="mt-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
            <p className="font-bold text-indigo-400 mb-1">🎨 Split-Screen изображение:</p>
            <p className="text-indigo-300">Изображение показывает две позиции: ИСХОДНОЕ (слева) и ФИНАЛЬНОЕ (справа) положение с красными стрелками, указывающими направление движения</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExerciseCardTest;
