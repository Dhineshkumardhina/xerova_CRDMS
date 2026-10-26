import React from 'react';
import { BookOpen, ShieldAlert, LifeBuoy, Terminal, HelpCircle } from 'lucide-react';

export const SupportLexiconView: React.FC = () => {
  const terms = [
    {
      acronym: 'CRMS',
      term: 'Crime Record Management System',
      definition:
        'A centralized electronic ledger designed for criminal profiling, suspect tracking, FIR generation, and biometrics correlation across municipal jurisdictions.',
    },
    {
      acronym: 'FIR',
      term: 'First Information Report',
      definition:
        'A formal document prepared by state law enforcement agencies when receiving information about the commission of a cognizable offense.',
    },
    {
      acronym: 'BOLO',
      term: 'Be On the Lookout',
      definition:
        'An all-points bulletin broadcast to patrolling officers containing subject descriptions, vehicle license plates, and active felony warrants.',
    },
    {
      acronym: 'CJIS',
      term: 'Criminal Justice Information Services',
      definition:
        'Federal compliance standard governing access controls, encryption, biometric repositories, and strict role-based access for law enforcement terminals.',
    },
    {
      acronym: 'Landmark Biometrics',
      term: 'Facial Node Extraction',
      definition:
        'Biometric computer vision processing that matches 128 nodal points (inter-ocular distance, nasal bridge, cheekbone coordinates) against archival mugshot databases.',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto w-full">
      <div className="border-b border-[#E5E7EB] pb-4">
        <h1 className="text-[24px] md:text-[30px] font-bold text-neutral-900 tracking-tight">
          System Support &amp; Statutory Lexicon
        </h1>
        <p className="text-[14px] md:text-[16px] text-neutral-500 mt-1">
          Operational terminology, penal code reference guide, and technical terminal dispatch.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs">
            <h3 className="text-[16px] font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-slate-800" />
              <span>Standard Operational Lexicon</span>
            </h3>
            <div className="divide-y divide-[#E5E7EB]">
              {terms.map((t) => (
                <div key={t.acronym} className="py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[12px] font-bold px-2 py-0.5 rounded-md bg-neutral-900 text-white">
                      {t.acronym}
                    </span>
                    <span className="text-[14px] font-bold text-neutral-900">{t.term}</span>
                  </div>
                  <p className="text-[13px] text-neutral-600 leading-relaxed pl-1">{t.definition}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-3.5">
            <h3 className="text-[16px] font-bold text-neutral-900 flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-slate-800" />
              <span>DOJ Help Desk</span>
            </h3>
            <p className="text-[12px] text-neutral-500">
              Need technical support or node re-authentication?
            </p>
            <div className="p-3.5 bg-neutral-50 rounded-xl border border-[#E5E7EB] font-mono text-[12px] space-y-1 text-neutral-700">
              <div>Secure Hotline: <span className="text-neutral-900 font-semibold">1-800-555-CRMS</span></div>
              <div>Terminal: <span className="text-neutral-900 font-semibold">NODE-04-NYC</span></div>
              <div>Grid Status: <span className="text-emerald-700 font-semibold">OPERATIONAL</span></div>
            </div>
            <button
              onClick={() => alert('Encrypted dispatch ticket has been opened with the central DOJ admin desk.')}
              className="w-full py-2.5 bg-neutral-900 text-white text-[12px] font-bold rounded-xl hover:bg-black cursor-pointer shadow-xs transition-colors"
            >
              Open Support Ticket
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
