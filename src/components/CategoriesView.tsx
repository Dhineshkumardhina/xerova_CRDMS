import React from 'react';
import { CategoryStat, CriminalProfile, CrimeCategoryType } from '../types';
import { ChevronRight, ArrowUpRight } from 'lucide-react';

interface CategoriesViewProps {
  categories: CategoryStat[];
  allProfiles: CriminalProfile[];
  onSelectCategory: (category: CrimeCategoryType) => void;
  onSelectProfile: (profile: CriminalProfile) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  allProfiles,
  onSelectCategory,
  onSelectProfile,
}) => {
  return (
    <div className="space-y-6 max-w-[1440px] mx-auto w-full">
      <div className="border-b border-[#E5E7EB] pb-4">
        <h1 className="text-[24px] md:text-[30px] font-bold text-[#171717] tracking-tight">
          Crime Categories &amp; Classifications
        </h1>
        <p className="text-[14px] md:text-[16px] text-[#525252] mt-1">
          Statutory classification index across active jurisdictions and municipal registries.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const profilesInCat = allProfiles.filter((p) => p.category === cat.category);
          return (
            <div
              key={cat.category}
              className="bg-white border border-[#E5E5E5] rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col justify-between hover:border-slate-400 hover:shadow-md transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-12 h-12 bg-neutral-100 text-slate-800 border border-[#E5E5E5] rounded-[8px] flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors"
                  >
                    <span
                      className="material-symbols-outlined text-[26px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {cat.iconName}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-[6px] bg-neutral-100 border border-[#E5E5E5] text-[#525252]">
                    {profilesInCat.length} Indexed
                  </span>
                </div>

                <h3 className="text-[18px] font-bold text-[#171717] group-hover:text-[#171717] transition-colors">
                  {cat.category}
                </h3>
                <p className="text-[12px] text-[#525252] mt-1 leading-relaxed">
                  {cat.recordsCount} total incidents recorded in current fiscal year.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E5E5E5] flex items-center justify-between">
                <button
                  onClick={() => onSelectCategory(cat.category)}
                  className="text-[13px] font-semibold text-[#171717] group-hover:text-[#171717] flex items-center gap-1 cursor-pointer hover:underline"
                >
                  <span>Explore Category</span>
                  <ChevronRight className="w-4 h-4 text-[#525252] group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
