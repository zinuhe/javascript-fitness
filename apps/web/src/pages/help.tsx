import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';

type Lang = 'en' | 'es';

const LANGS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
];

interface Topic {
  question: string;
  answer: ReactNode;
}

/** A worked calculation, set apart from the text around it. */
function Example({ children }: { children: ReactNode }) {
  return <p className="help-example">{children}</p>;
}

const TOPICS: Record<Lang, Topic[]> = {
  en: [
    {
      question: 'What does each point of the progress chart show?',
      answer: (
        <>
          <p>
            The <strong>estimated 1RM</strong> of that session: the most weight you could, in
            theory, lift for a single rep that day.
          </p>
          <p>
            It uses the <strong>Epley</strong> formula on every set of the session and keeps the
            highest value:
          </p>
          <Example>Estimated 1RM = weight × (1 + reps ÷ 30)</Example>
          <p>A set of 1 rep counts as is: its weight is the 1RM.</p>
        </>
      ),
    },
    {
      question: 'Examples',
      answer: (
        <>
          <p>All sets the same, 4 × 12 — 50 lb:</p>
          <Example>50 × (1 + 12 ÷ 30) = 50 × 1.4 = 70 lb</Example>
          <p>Different sets, 5 × 215 lb and 5 × 220.5 lb:</p>
          <Example>
            215 × (1 + 5 ÷ 30) = 250.8 lb
            <br />
            220.5 × (1 + 5 ÷ 30) = 257.3 lb → the point is 257.3 lb
          </Example>
          <p>One heavy rep, 1 × 240 lb:</p>
          <Example>240 lb</Example>
        </>
      ),
    },
    {
      question: 'Why is it useful?',
      answer: (
        <p>
          It turns weight and reps into one number, so a day of 12 light reps can be compared with a
          day of 5 heavy ones. If the line goes up, you are getting stronger even when the weight
          did not change. It is an estimate: most accurate with sets of up to about 10 reps.
        </p>
      ),
    },
    {
      question: 'Details of the chart',
      answer: (
        <ul>
          <li>
            <strong>Barbell:</strong> the total weight is used, plates plus bar.
          </li>
          <li>
            <strong>Several equipment:</strong> the chart shows the equipment picked in the tabs
            (Barbell, Dumbbell…), never a mix.
          </li>
          <li>
            <strong>Horizontal axis:</strong> points are evenly spaced, however many days passed
            between sessions.
          </li>
          <li>
            <strong>Vertical axis:</strong> it spans the lowest to the highest value, so small
            changes look like big rises or drops.
          </li>
          <li>
            <strong>Hover or tap a point</strong> to see that day and its sets.
          </li>
        </ul>
      ),
    },
    {
      question: 'What is volume?',
      answer: (
        <>
          <p>The reps × weight of every set, added up: how much work the session moved.</p>
          <Example>4 × 12 — 50 lb → 4 × 12 × 50 = 2400 lb</Example>
        </>
      ),
    },
  ],
  es: [
    {
      question: '¿Qué muestra cada punto de la gráfica de progreso?',
      answer: (
        <>
          <p>
            El <strong>1RM estimado</strong> de esa sesión: el peso máximo que, en teoría, podrías
            levantar una sola vez ese día.
          </p>
          <p>
            Usa la fórmula de <strong>Epley</strong> en cada serie de la sesión y se queda con el
            valor más alto:
          </p>
          <Example>1RM estimado = peso × (1 + reps ÷ 30)</Example>
          <p>Una serie de 1 repetición cuenta tal cual: su peso es el 1RM.</p>
        </>
      ),
    },
    {
      question: 'Ejemplos',
      answer: (
        <>
          <p>Todas las series iguales, 4 × 12 — 50 lb:</p>
          <Example>50 × (1 + 12 ÷ 30) = 50 × 1.4 = 70 lb</Example>
          <p>Series distintas, 5 × 215 lb y 5 × 220.5 lb:</p>
          <Example>
            215 × (1 + 5 ÷ 30) = 250.8 lb
            <br />
            220.5 × (1 + 5 ÷ 30) = 257.3 lb → el punto queda en 257.3 lb
          </Example>
          <p>Una repetición pesada, 1 × 240 lb:</p>
          <Example>240 lb</Example>
        </>
      ),
    },
    {
      question: '¿Para qué sirve?',
      answer: (
        <p>
          Junta peso y repeticiones en un solo número, así puedes comparar un día de 12 reps con
          poco peso y otro de 5 reps con más peso. Si la línea sube, te estás haciendo más fuerte
          aunque no hayas subido el peso. Es una estimación: funciona mejor con series de hasta unas
          10 repeticiones.
        </p>
      ),
    },
    {
      question: 'Detalles de la gráfica',
      answer: (
        <ul>
          <li>
            <strong>Con barra:</strong> se usa el peso total, discos más barra.
          </li>
          <li>
            <strong>Varios equipos:</strong> la gráfica muestra el equipo elegido en las pestañas
            (Barbell, Dumbbell…), nunca una mezcla.
          </li>
          <li>
            <strong>Eje horizontal:</strong> los puntos van a la misma distancia, sin importar
            cuántos días pasaron entre sesiones.
          </li>
          <li>
            <strong>Eje vertical:</strong> va del valor más bajo al más alto, así que cambios chicos
            se ven como subidas o bajadas grandes.
          </li>
          <li>
            <strong>Pasa el cursor o toca un punto</strong> para ver ese día y sus series.
          </li>
        </ul>
      ),
    },
    {
      question: '¿Qué es el volumen?',
      answer: (
        <>
          <p>Las reps × el peso de cada serie, sumadas: cuánto trabajo movió la sesión.</p>
          <Example>4 × 12 — 50 lb → 4 × 12 × 50 = 2400 lb</Example>
        </>
      ),
    },
  ],
};

const TITLE: Record<Lang, string> = { en: 'Help', es: 'Ayuda' };

/** How the numbers in the app are worked out, in English or Spanish. */
export function HelpPage() {
  const [lang, setLang] = useState<Lang>('en');
  return (
    <section className="stack">
      <div>
        <Link to="/account" className="muted back-link">
          ← Account
        </Link>
        <h1>{TITLE[lang]}</h1>
      </div>
      <div className="segmented" role="radiogroup" aria-label="Language">
        {LANGS.map(({ value, label }) => (
          <label key={value}>
            <input
              type="radio"
              name="helpLang"
              value={value}
              checked={lang === value}
              onChange={() => setLang(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      <div className="stack" lang={lang}>
        {TOPICS[lang].map((topic, i) => (
          <details key={topic.question} className="card help-topic" open={i < 2}>
            <summary>{topic.question}</summary>
            <div className="stack-tight">{topic.answer}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
