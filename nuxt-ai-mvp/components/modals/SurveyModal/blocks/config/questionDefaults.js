// questionDefaults.js
// Funções de configuração padrão para cada tipo de pergunta

export function openTextDefault() {
  return {
    questionText: '',
    isRequired: false,
  };
}

export function multipleChoiceDefault() {
  return {
    questionText: '',
    options: [],
    allowMultiple: false,
    isRequired: false,
  };
}

export function opinionScaleDefault() {
  return {
    questionText: '',
    minValue: 1,
    maxValue: 5,
    startLabel: 'Discordo totalmente',
    endLabel: 'Concordo totalmente',
    isRequired: false,
  };
}

export function satisfactionScaleDefault() {
  return {
    questionText: '',
    minValue: 1,
    maxValue: 5,
    startLabel: 'Muito insatisfeito',
    endLabel: 'Muito satisfeito',
    isRequired: false,
  };
}
