import '@testing-library/jest-dom';

// JSDOM no implementa el diálogo nativo. El foco modal real se verifica en navegador.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
}
