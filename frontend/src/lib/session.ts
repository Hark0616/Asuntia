// Distingue respuestas de sesiones sucesivas sin persistir credenciales.
let sessionGeneration = 0;
export const SESSION_EXPIRED_EVENT = 'asuntia:session-expired';
export const currentSessionGeneration = () => sessionGeneration;
export const advanceSessionGeneration = () => { sessionGeneration += 1; };
