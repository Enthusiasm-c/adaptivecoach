/**
 * ImbalanceEducationModal Component
 *
 * Educational modal explaining what muscle imbalances mean,
 * why they matter, and how to fix them.
 */

import React from 'react';
import { ImbalanceReport } from '../types';
import { X, AlertTriangle, Target, Dumbbell, Sparkles } from 'lucide-react';

interface ImbalanceEducationModalProps {
  imbalance: ImbalanceReport;
  onClose: () => void;
  onUpgrade?: () => void;
  isPro: boolean;
}

const ImbalanceEducationModal: React.FC<ImbalanceEducationModalProps> = ({
  imbalance,
  onClose,
  onUpgrade,
  isPro,
}) => {
  const content = getEducationalContent(imbalance.type);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="p-4 border-b border-neutral-700 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-400" />
            <h2 className="text-lg font-bold text-white">{content.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-700 text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* What is it */}
          <Section title="Что это значит?">
            <p className="text-gray-300 text-sm">{content.whatIsIt}</p>
          </Section>

          {/* Why it matters */}
          <Section title="Почему это важно?" icon={<AlertTriangle size={14} className="text-red-400" />}>
            <ul className="space-y-2">
              {content.risks.map((risk, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-red-400 mt-0.5">•</span>
                  {risk}
                </li>
              ))}
            </ul>
          </Section>

          {/* How to fix */}
          <Section title="Как исправить?" icon={<Target size={14} className="text-emerald-400" />}>
            <p className="text-gray-300 text-sm mb-2">{content.howToFix}</p>
            {content.exercises.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {content.exercises.map((ex, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  >
                    {ex}
                  </span>
                ))}
              </div>
            )}
          </Section>

          {/* Current recommendation */}
          {imbalance.recommendation && (
            <Section title="Рекомендация" icon={<Dumbbell size={14} className="text-indigo-400" />}>
              <p className="text-gray-300 text-sm">{imbalance.recommendation}</p>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-700">
          {isPro ? (
            <button
              onClick={onClose}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all"
            >
              Понятно
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={onUpgrade}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Sparkles size={16} />
                Получить персональный план
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 text-gray-400 text-sm hover:text-white transition-all"
              >
                Позже
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, icon, children }) => (
  <div className="bg-neutral-700/30 rounded-xl p-3">
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <h3 className="text-sm font-medium text-white">{title}</h3>
    </div>
    {children}
  </div>
);

interface EducationalContent {
  title: string;
  whatIsIt: string;
  risks: string[];
  howToFix: string;
  exercises: string[];
}

function getEducationalContent(type: string): EducationalContent {
  switch (type) {
    case 'push_pull':
      return {
        title: 'Дисбаланс жим/тяга',
        whatIsIt:
          'Твои жимовые мышцы (грудь, передние дельты) значительно сильнее тяговых (спина, задние дельты). Это частая проблема у тех, кто фокусируется на "зеркальных" мышцах.',
        risks: [
          'Округление плеч и сутулость',
          'Боли в шее и верхней части спины',
          'Повышенный риск травм плечевого сустава',
          'Ограничение прогресса в жимовых упражнениях',
        ],
        howToFix:
          'Добавь больше тяговых упражнений. Идеальное соотношение — 1:1 между жимом и тягой.',
        exercises: ['Тяга штанги в наклоне', 'Подтягивания', 'Тяга блока', 'Face Pulls'],
      };

    case 'anterior_posterior':
      return {
        title: 'Дисбаланс мышц ног',
        whatIsIt:
          'Дисбаланс между квадрицепсами (передняя часть бедра) и ягодицами с бицепсом бедра (задняя часть). Часто возникает при избытке приседаний и недостатке становых тяг.',
        risks: [
          'Боли в пояснице',
          'Повышенный риск травм колена',
          'Неправильная осанка таза',
          'Снижение взрывной силы',
        ],
        howToFix:
          'Добавь упражнения на ягодицы и бицепс бедра. Соотношение становая:присед должно быть примерно 1.2:1.',
        exercises: ['Румынская тяга', 'Сгибание ног', 'Hip Thrust', 'Good Morning'],
      };

    case 'ratio':
      return {
        title: 'Верх/Низ тела',
        whatIsIt:
          'Непропорциональное развитие верхней и нижней частей тела. Присед должен быть сильнее жима примерно на 30%.',
        risks: [
          'Непропорциональное телосложение',
          'Ограничение общей силы',
          'Повышенная нагрузка на позвоночник',
        ],
        howToFix:
          'Сбалансируй тренировки верха и низа. Не пропускай день ног!',
        exercises: ['Приседания', 'Жим ногами', 'Выпады', 'Становая тяга'],
      };

    default:
      return {
        title: 'Мышечный дисбаланс',
        whatIsIt:
          'Обнаружено непропорциональное развитие мышечных групп, которое может повлиять на производительность и здоровье.',
        risks: [
          'Повышенный риск травм',
          'Ограничение прогресса',
          'Проблемы с осанкой',
        ],
        howToFix: 'Следуй рекомендациям ниже для исправления дисбаланса.',
        exercises: [],
      };
  }
}

export default ImbalanceEducationModal;
