import { closesAt, isClosed } from '../lib/closing.js';

// Devolve a data de encerramento da simulação em vigor (a padrão do código ou
// a da env SIMULATION_CLOSES_AT), para a página /encerrado exibir a data certa.
// Só leitura: não grava nada e não usa o banco.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    closesAt: new Date(closesAt()).toISOString(),
    closed: isClosed(),
  });
}
