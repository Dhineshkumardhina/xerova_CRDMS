import React, { useState, useEffect, useRef } from 'react';
import { CriminalProfile, CrimeCategoryType, RiskLevel, RecordStatus, RelativeDetail, SocialMediaDetail } from '../types';
import { X, Plus, Trash2, Check, Camera, Upload, Image as ImageIcon, Link as LinkIcon, RefreshCw, AlertCircle, Users, Share2, Phone, MapPin, Globe, AtSign, CreditCard, Smartphone } from 'lucide-react';

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Jammu and Kashmir',
  'Ladakh',
  'Puducherry',
  'Chandigarh',
];

const formatIndianPhone = (raw: string): string => {
  const digitsOnly = raw.replace(/\D/g, '');
  if (!digitsOnly) return '+91 ';
  let phoneNum = digitsOnly;
  if (phoneNum.startsWith('91')) {
    phoneNum = phoneNum.slice(2);
  }
  phoneNum = phoneNum.slice(0, 10);
  if (phoneNum.length > 5) {
    return `+91 ${phoneNum.slice(0, 5)} ${phoneNum.slice(5)}`;
  }
  return `+91 ${phoneNum}`;
};

const formatAadhaar = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
};

const PRESET_MUGSHOTS = [
  {
    id: 'preset-1',
    label: 'Male Subject A',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIu7ti2U6UgzTqjYLtCJttkM3F8l79UhGkFjmrEFwHuSdj_KR_2wePqdc2QumCcpVwZBK75KN8Ws9spYxw3ckKm-hQl-CvexsNye3L8eC5j9gUrvfLj14uVa6YHDvgu8ZuJDZTu5X82_vIHkKL4OPxs9zT2syZV3jxwlfKA3HhOlY-18i-eSsdmjX_S6fH3I8fXSvHT422jXePg_KU9oAnrJBGmsnVBXZj2ppIRrtxNaOuELyRkcIK',
  },
  {
    id: 'preset-2',
    label: 'Male Subject B',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCjTdgTAaNLyWqi-QA2meJslif30R9XEdqYPH1GA6ejLDaUoC9H4nSFtioYu9yzLVQ3BGXiDVGpCH6P0VVYJiBc5X3Xvki83N8ryF1AE4yKKZYpcNZWfQwkjKEkm1QIxdaT3COwzrAvzrycJS1d_NHVRgojJp69BcOYWSMvXJZzwp5dJDnf92sI9Nf8-G6uPBNwYK-C2CdIs7izga2jOIJgAtGVpTbs-nrQT0qtYYNeWF5aAwyN7pc9',
  },
  {
    id: 'preset-3',
    label: 'Female Subject A',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBcLIqeYRV-gHLs3Hbj30DeuW9oYkX0R22WbhPENF2-52Ocfuszsv8qkwJiYsYey-_s03SeyeZJm4DClgJcyr4UEV51v-ZokyoUu21R5f_oRIdmOS1flzBzGfEx-bAOIl_Jf1QqAltmRbSS7iyJNTaONtXxNr230gYEhryyaw3QujJ4xhfwvtWxv7tjlmIPF5jMscoRSADz_Ug2N0vyq6dKE5pwitdg7I2Xc-ksLhDVQcAr5gEmRTuB',
  },
  {
    id: 'preset-4',
    label: 'Male Subject C',
    url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDfOerAeg740eBBPZZwICqsV7QlwGLY17myzWKfhncXDUsEsuiDGi-lTxevRAWH8KJrrBZTedTvuUB8zU3EvGLxtgrTHpCByVG0twch3CmCvs2Xzi01iv7AqKZr9zdSybKLRrUkAL_TvhkSz3A166hKZGSufkLzQOM5akbUXUXTLrn0dzxdyWSK3YTCpbkzd39iUcJla42nEDsuG4TMTsv_k85Gxb1mKQm-IeVhwWNDbo2rGdRcxidF',
  },
];

interface NewRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: CriminalProfile) => void;
  editingProfile?: CriminalProfile | null;
}

export const NewRecordModal: React.FC<NewRecordModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingProfile,
}) => {
  const [formData, setFormData] = useState<Partial<CriminalProfile>>({
    name: '',
    alias: '',
    fatherName: '',
    dob: '1990-01-01',
    age: 34,
    gender: 'Male',
    phone: '+91 98765 43210',
    identificationNumber: 'XXXX-XXXX-9012',
    rawIdNumber: '5432 1098 9012',
    primaryAddress: '',
    city: 'New Delhi',
    state: 'Delhi',
    height: '178 cm',
    weight: '75 kg',
    eyeColor: 'Brown',
    hairColor: 'Black',
    mugshotUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAIu7ti2U6UgzTqjYLtCJttkM3F8l79UhGkFjmrEFwHuSdj_KR_2wePqdc2QumCcpVwZBK75KN8Ws9spYxw3ckKm-hQl-CvexsNye3L8eC5j9gUrvfLj14uVa6YHDvgu8ZuJDZTu5X82_vIHkKL4OPxs9zT2syZV3jxwlfKA3HhOlY-18i-eSsdmjX_S6fH3I8fXSvHT422jXePg_KU9oAnrJBGmsnVBXZj2ppIRrtxNaOuELyRkcIK',
    mugshotDate: new Date().toISOString().split('T')[0],
    riskLevel: 'Medium Risk',
    status: 'Active',
    category: 'Theft',
    totalCases: 1,
    convictions: 0,
    activeCasesCount: 1,
    identificationMarks: [],
    cases: [],
    documents: [],
    media: [],
    relatives: [],
    socialMedia: [],
  });

  const [newMark, setNewMark] = useState('');
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Relatives State
  const [relName, setRelName] = useState('');
  const [relRelation, setRelRelation] = useState('Father');
  const [relPhone, setRelPhone] = useState('');
  const [relAadhaar, setRelAadhaar] = useState('');
  const [relImei, setRelImei] = useState('');
  const [relAddress, setRelAddress] = useState('');
  const [relPhotoUrl, setRelPhotoUrl] = useState('');
  const relFileInputRef = useRef<HTMLInputElement>(null);

  const handleRelPhotoChange = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPEG, PNG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setRelPhotoUrl(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Social Media State
  const [smPlatform, setSmPlatform] = useState('Instagram');
  const [smHandle, setSmHandle] = useState('');
  const [smUrl, setSmUrl] = useState('');

  const handlePhotoFileChange = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPEG, PNG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setFormData((prev) => ({
          ...prev,
          mugshotUrl: e.target?.result as string,
          mugshotDate: new Date().toISOString().split('T')[0],
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDropPhoto = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhoto(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePhotoFileChange(e.dataTransfer.files[0]);
    }
  };

  useEffect(() => {
    if (editingProfile) {
      setFormData({
        ...editingProfile,
        relatives: editingProfile.relatives || [],
        socialMedia: editingProfile.socialMedia || [],
      });
    } else {
      setFormData({
        id: `CR-${Math.floor(100000 + Math.random() * 900000)}`,
        name: '',
        alias: '',
        fatherName: '',
        dob: '1990-01-01',
        age: 34,
        gender: 'Male',
        phone: '+91 98765 43210',
        identificationNumber: 'XXXX-XXXX-9012',
        rawIdNumber: '5432 1098 9012',
        primaryAddress: '',
        city: 'New Delhi',
        state: 'Delhi',
        height: '178 cm',
        weight: '75 kg',
        eyeColor: 'Brown',
        hairColor: 'Black',
        mugshotUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuAIu7ti2U6UgzTqjYLtCJttkM3F8l79UhGkFjmrEFwHuSdj_KR_2wePqdc2QumCcpVwZBK75KN8Ws9spYxw3ckKm-hQl-CvexsNye3L8eC5j9gUrvfLj14uVa6YHDvgu8ZuJDZTu5X82_vIHkKL4OPxs9zT2syZV3jxwlfKA3HhOlY-18i-eSsdmjX_S6fH3I8fXSvHT422jXePg_KU9oAnrJBGmsnVBXZj2ppIRrtxNaOuELyRkcIK',
        mugshotDate: new Date().toISOString().split('T')[0],
        riskLevel: 'Medium Risk',
        status: 'Active',
        category: 'Theft',
        totalCases: 1,
        convictions: 0,
        activeCasesCount: 1,
        identificationMarks: [
          { id: 'm-1', type: 'scar', description: 'Scar on right eyebrow.' },
        ],
        cases: [
          {
            id: 'c-1',
            caseNumber: `FIR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            description: 'Preliminary investigation docket opened.',
            dateFiled: 'Today',
            status: 'Under Investigation',
            category: 'Theft',
          },
        ],
        documents: [],
        media: [],
        relatives: [],
        socialMedia: [],
      });
    }
  }, [editingProfile, isOpen]);

  if (!isOpen) return null;

  const handleAddMark = () => {
    if (!newMark.trim()) return;
    const markObj = {
      id: `mark-${Date.now()}`,
      type: 'mark' as const,
      description: newMark.trim(),
    };
    setFormData((prev) => ({
      ...prev,
      identificationMarks: [...(prev.identificationMarks || []), markObj],
    }));
    setNewMark('');
  };

  const handleRemoveMark = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      identificationMarks: (prev.identificationMarks || []).filter((m) => m.id !== id),
    }));
  };

  const handleAddRelative = () => {
    if (!relName.trim()) return;
    const newRelative: RelativeDetail = {
      id: `rel-${Date.now()}`,
      name: relName.trim(),
      relation: relRelation,
      phone: relPhone.trim() || undefined,
      aadhaar: relAadhaar.trim() || undefined,
      imei: relImei.trim() || undefined,
      address: relAddress.trim() || undefined,
      photoUrl: relPhotoUrl || undefined,
    };
    setFormData((prev) => ({
      ...prev,
      relatives: [...(prev.relatives || []), newRelative],
    }));
    setRelName('');
    setRelPhone('');
    setRelAadhaar('');
    setRelImei('');
    setRelAddress('');
    setRelPhotoUrl('');
  };

  const handleRemoveRelative = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      relatives: (prev.relatives || []).filter((r) => r.id !== id),
    }));
  };

  const handleAddSocialMedia = () => {
    if (!smHandle.trim()) return;
    let handle = smHandle.trim();
    if (!handle.startsWith('@') && !handle.startsWith('http') && smPlatform !== 'Other') {
      handle = `@${handle}`;
    }
    const newSocial: SocialMediaDetail = {
      id: `sm-${Date.now()}`,
      platform: smPlatform,
      handle,
      profileUrl: smUrl.trim() || undefined,
    };
    setFormData((prev) => ({
      ...prev,
      socialMedia: [...(prev.socialMedia || []), newSocial],
    }));
    setSmHandle('');
    setSmUrl('');
  };

  const handleRemoveSocialMedia = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      socialMedia: (prev.socialMedia || []).filter((s) => s.id !== id),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      alert('Subject name is required.');
      return;
    }
    const finalProfile: CriminalProfile = {
      id: formData.id || `CR-${Math.floor(100000 + Math.random() * 900000)}`,
      name: formData.name,
      alias: formData.alias,
      fatherName: formData.fatherName || 'Unknown',
      dob: formData.dob || '1990-01-01',
      age: Number(formData.age) || 30,
      gender: (formData.gender as any) || 'Male',
      phone: formData.phone || '+91 98765 43210',
      identificationNumber: formData.identificationNumber || 'XXXX-XXXX-0000',
      rawIdNumber: formData.rawIdNumber || '0000-0000-0000',
      imei: formData.imei?.trim() || undefined,
      primaryAddress: formData.primaryAddress || 'Unregistered Address',
      city: formData.city || 'New Delhi',
      state: formData.state || 'Delhi',
      height: formData.height || '175 cm',
      weight: formData.weight || '75 kg',
      eyeColor: formData.eyeColor || 'Brown',
      hairColor: formData.hairColor || 'Dark',
      mugshotUrl:
        formData.mugshotUrl ||
        'https://lh3.googleusercontent.com/aida-public/AB6AXuAIu7ti2U6UgzTqjYLtCJttkM3F8l79UhGkFjmrEFwHuSdj_KR_2wePqdc2QumCcpVwZBK75KN8Ws9spYxw3ckKm-hQl-CvexsNye3L8eC5j9gUrvfLj14uVa6YHDvgu8ZuJDZTu5X82_vIHkKL4OPxs9zT2syZV3jxwlfKA3HhOlY-18i-eSsdmjX_S6fH3I8fXSvHT422jXePg_KU9oAnrJBGmsnVBXZj2ppIRrtxNaOuELyRkcIK',
      mugshotDate: formData.mugshotDate || 'Today',
      riskLevel: (formData.riskLevel as RiskLevel) || 'Medium Risk',
      status: (formData.status as RecordStatus) || 'Active',
      category: (formData.category as CrimeCategoryType) || 'Theft',
      totalCases: formData.cases?.length || 1,
      convictions: formData.convictions || 0,
      activeCasesCount:
        formData.cases?.filter((c) => c.status !== 'Closed').length || 1,
      identificationMarks: formData.identificationMarks || [],
      cases: formData.cases || [],
      documents: formData.documents || [],
      media: formData.media || [],
      relatives: formData.relatives || [],
      socialMedia: formData.socialMedia || [],
      isHistorical: formData.isHistorical || false,
    };

    onSave(finalProfile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs select-none animate-backdrop-enter">
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-modal-enter">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F8F9FA]">
          <div>
            <h3 className="text-[18px] font-bold text-neutral-900">
              {editingProfile ? `Edit Record: ${editingProfile.name}` : 'Create New Criminal Record'}
            </h3>
            <p className="text-[12px] text-neutral-500">
              Registry File ID: <span className="font-mono text-neutral-800 font-semibold">{formData.id}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 p-1.5 rounded-lg hover:bg-neutral-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-[13px]">
          {/* Criminal Image / Mugshot Record Section */}
          <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-[10px] p-4.5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-[6px] bg-[#3B5B7A]/10 text-[#3B5B7A]">
                  <Camera className="w-4 h-4" />
                </span>
                <h4 className="text-[12px] font-bold text-neutral-900 uppercase tracking-wider">
                  Criminal Mugshot &amp; Photographic Evidence
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-neutral-500 font-mono">
                {formData.mugshotUrl ? 'Image Attached' : 'Photo Required'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Photo Preview Card */}
              <div className="md:col-span-4 flex flex-col items-center">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDraggingPhoto(true);
                  }}
                  onDragLeave={() => setIsDraggingPhoto(false)}
                  onDrop={handleDropPhoto}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full aspect-3/4 max-w-[170px] rounded-lg border-2 border-dashed relative overflow-hidden flex flex-col items-center justify-center cursor-pointer transition-all bg-neutral-900 group ${
                    isDraggingPhoto
                      ? 'border-[#3B5B7A] bg-[#3B5B7A]/20 scale-102'
                      : formData.mugshotUrl
                      ? 'border-[#E5E7EB] hover:border-[#3B5B7A]'
                      : 'border-neutral-300 hover:border-neutral-400 bg-neutral-100'
                  }`}
                >
                  {formData.mugshotUrl ? (
                    <>
                      <img
                        src={formData.mugshotUrl}
                        alt="Subject Mugshot"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-center"
                      />
                      {/* Metric lines overlay for law enforcement dossier aesthetic */}
                      <div className="absolute inset-0 border border-white/20 pointer-events-none flex flex-col justify-between p-1.5 opacity-60">
                        <div className="flex justify-between text-[8px] font-mono text-white/80 font-bold">
                          <span>REG-ID</span>
                          <span>{formData.id?.slice(-4) || 'LIVE'}</span>
                        </div>
                        <div className="w-full border-t border-dashed border-white/40 my-auto" />
                        <div className="flex justify-between text-[8px] font-mono text-white/80">
                          <span>SCALE: 1:1</span>
                          <span>{formData.mugshotDate || 'TODAY'}</span>
                        </div>
                      </div>
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white p-2 text-center">
                        <Upload className="w-5 h-5 mb-1" />
                        <span className="text-[11px] font-semibold">Click / Drop to Replace</span>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 text-center text-neutral-400 flex flex-col items-center">
                      <Camera className="w-8 h-8 mb-2 text-neutral-300" />
                      <span className="text-[11px] font-bold text-neutral-700 block">Upload Mugshot</span>
                      <span className="text-[10px] text-neutral-400 mt-0.5">Drag photo or click to browse</span>
                    </div>
                  )}
                </div>

                {formData.mugshotUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] font-semibold text-[#3B5B7A] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3" /> Change Photo
                    </button>
                    <span className="text-neutral-300">•</span>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, mugshotUrl: '' }))}
                      className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Upload Controls & Presets */}
              <div className="md:col-span-8 space-y-3">
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handlePhotoFileChange(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {/* Upload Button + Capture Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                      Device Upload
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-9 px-3 bg-white hover:bg-neutral-50 text-neutral-800 border border-[#E5E7EB] rounded-lg text-[12px] font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#3B5B7A]" />
                      <span>Choose Image File...</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                      Photo Intake Date
                    </label>
                    <input
                      type="date"
                      value={formData.mugshotDate || ''}
                      onChange={(e) => setFormData({ ...formData, mugshotDate: e.target.value })}
                      className="w-full h-9 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-mono text-[11.5px] bg-white text-neutral-900 transition-all shadow-xs"
                    />
                  </div>
                </div>

                {/* Direct Image URL Input */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">
                    Direct Image URL (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-400">
                      <LinkIcon className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="url"
                      value={formData.mugshotUrl || ''}
                      onChange={(e) => setFormData({ ...formData, mugshotUrl: e.target.value })}
                      placeholder="https://images.example.com/mugshots/subject_01.jpg"
                      className="w-full h-9 pl-8 pr-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none text-[12px] bg-white text-neutral-900 transition-all shadow-xs"
                    />
                  </div>
                </div>

                {/* Sample Presets Quick Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-600 mb-1.5">
                    Or select a verified sample portrait:
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {PRESET_MUGSHOTS.map((preset) => {
                      const isSelected = formData.mugshotUrl === preset.url;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              mugshotUrl: preset.url,
                              mugshotDate: prev.mugshotDate || new Date().toISOString().split('T')[0],
                            }))
                          }
                          className={`relative rounded-lg overflow-hidden border p-1 flex flex-col items-center gap-1 transition-all cursor-pointer bg-white ${
                            isSelected
                              ? 'border-[#3B5B7A] ring-2 ring-[#3B5B7A]/30 shadow-xs'
                              : 'border-[#E5E7EB] hover:border-neutral-400'
                          }`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.label}
                            referrerPolicy="no-referrer"
                            className="w-full aspect-square object-cover rounded-[4px]"
                          />
                          <span className="text-[9.5px] font-semibold text-neutral-700 truncate w-full text-center">
                            {preset.label}
                          </span>
                          {isSelected && (
                            <span className="absolute top-1 right-1 bg-[#3B5B7A] text-white p-0.5 rounded-full">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Identity Section */}
          <div>
            <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-3">
              Subject Identification
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Raj Kumar Sharma"
                  className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Street Alias / Known As
                </label>
                <input
                  type="text"
                  value={formData.alias || ''}
                  onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                  placeholder='e.g. "The Wraith"'
                  className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Father&apos;s Name
                </label>
                <input
                  type="text"
                  value={formData.fatherName || ''}
                  onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                  placeholder="e.g. Suresh Kumar"
                  className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={formData.dob || ''}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none font-mono text-[12px] bg-white text-neutral-900 transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Gender
                </label>
                <select
                  value={formData.gender || 'Male'}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 font-medium transition-all shadow-xs"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Classification & Risk */}
          <div className="border-t border-[#E5E7EB] pt-4">
            <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-3">
              Classification &amp; Risk Rating
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Primary Crime Category
                </label>
                <select
                  value={formData.category || 'Theft'}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white font-medium text-neutral-900 transition-all shadow-xs"
                >
                  <option value="Theft">Theft</option>
                  <option value="Assault">Assault</option>
                  <option value="Fraud">Fraud</option>
                  <option value="Narcotics">Narcotics</option>
                  <option value="Fugitive">Fugitive</option>
                  <option value="Vehicle">Vehicle</option>
                  <option value="Cybercrime">Cybercrime</option>
                  <option value="Financial">Financial</option>
                  <option value="Homicide">Homicide</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Risk Level
                </label>
                <select
                  value={formData.riskLevel || 'Medium Risk'}
                  onChange={(e) => setFormData({ ...formData, riskLevel: e.target.value as any })}
                  className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 font-medium transition-all shadow-xs"
                >
                  <option value="High Risk">High Risk</option>
                  <option value="Medium Risk">Medium Risk</option>
                  <option value="Low Risk">Low Risk</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Case Status
                </label>
                <select
                  value={formData.status || 'Active'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 font-medium transition-all shadow-xs"
                >
                  <option value="Active">Active</option>
                  <option value="Warrant Issued">Warrant Issued</option>
                  <option value="Probation">Probation</option>
                  <option value="Cleared">Cleared</option>
                  <option value="Incarcerated">Incarcerated</option>
                  <option value="Historical Record">Historical Record</option>
                </select>
              </div>
            </div>
          </div>

          {/* Physical & Biometric Info */}
          <div className="border-t border-[#E5E7EB] pt-4">
            <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-3">
              Physical &amp; Contact Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Height
                </label>
                <input
                  type="text"
                  value={formData.height || ''}
                  onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  placeholder="e.g. 182 cm"
                  className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Weight
                </label>
                <input
                  type="text"
                  value={formData.weight || ''}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="e.g. 80 kg"
                  className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Eye Color
                </label>
                <input
                  type="text"
                  value={formData.eyeColor || ''}
                  onChange={(e) => setFormData({ ...formData, eyeColor: e.target.value })}
                  placeholder="e.g. Brown / Hazel"
                  className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Contact Phone Number (Indian Std +91)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: formatIndianPhone(e.target.value) })}
                    placeholder="+91 98765 43210"
                    maxLength={16}
                    className="w-full h-10 pl-9 pr-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 font-mono text-[13px] transition-all shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Aadhaar Card No (UIDAI 12-Digit)
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={formData.rawIdNumber || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const formatted = formatAadhaar(val);
                      const clean = formatted.replace(/\s+/g, '');
                      const masked = clean.length >= 4 
                        ? `XXXX-XXXX-${clean.slice(-4)}`
                        : clean ? `XXXX-XXXX-XXXX` : '';
                      setFormData({
                        ...formData,
                        rawIdNumber: formatted,
                        identificationNumber: masked || formatted,
                      });
                    }}
                    placeholder="e.g. 5432 1098 7654"
                    maxLength={14}
                    className="w-full h-10 pl-9 pr-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 font-mono text-[13px] tracking-wider transition-all shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Device IMEI Number (Forensics)
                </label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={formData.imei || ''}
                    onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                    placeholder="15-digit IMEI (e.g. 865432041234567)"
                    maxLength={18}
                    className="w-full h-10 pl-9 pr-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 font-mono text-[13px] tracking-wider transition-all shadow-xs"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  Primary Address
                </label>
                <input
                  type="text"
                  value={formData.primaryAddress || ''}
                  onChange={(e) => setFormData({ ...formData, primaryAddress: e.target.value })}
                  placeholder="e.g. Sector 15, Near Metro Hub"
                  className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-900 mb-1">
                  City &amp; State (India)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City (e.g. New Delhi)"
                    className="w-1/2 h-10 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 text-[13px] transition-all shadow-xs"
                  />
                  <select
                    value={formData.state || 'Delhi'}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-1/2 h-10 px-2.5 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 text-[12.5px] font-medium transition-all shadow-xs cursor-pointer"
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Identification Marks */}
          <div className="border-t border-[#E5E7EB] pt-4">
            <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-3">
              Identification Marks (Scars, Tattoos, Burns)
            </h4>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newMark}
                onChange={(e) => setNewMark(e.target.value)}
                placeholder="e.g. 2-inch vertical scar on left eyebrow..."
                className="flex-1 h-10 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 transition-all shadow-xs"
              />
              <button
                type="button"
                onClick={handleAddMark}
                className="px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-semibold rounded-lg border border-[#E5E7EB] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Mark
              </button>
            </div>

            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {(formData.identificationMarks || []).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg border border-[#E5E7EB]"
                >
                  <span className="text-[13px] text-neutral-800">{m.description}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMark(m.id)}
                    className="text-neutral-400 hover:text-red-600 p-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Relative Details & Next of Kin */}
          <div className="border-t border-[#E5E7EB] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-700" />
                <h4 className="text-[12px] font-bold text-neutral-800 uppercase tracking-wider">
                  Relative Details &amp; Known Next of Kin
                </h4>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-[#E5E7EB]">
                {(formData.relatives || []).length} Recorded
              </span>
            </div>

            {/* Hidden Relative Photo Input */}
            <input
              type="file"
              ref={relFileInputRef}
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleRelPhotoChange(e.target.files[0])}
              className="hidden"
            />

            {/* Relative Input Fields */}
            <div className="bg-[#F8F9FA] p-3.5 rounded-xl border border-[#E5E7EB] mb-3 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Relative / Contact Name
                  </label>
                  <input
                    type="text"
                    value={relName}
                    onChange={(e) => setRelName(e.target.value)}
                    placeholder="Full legal name"
                    className="w-full h-9 px-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 text-[13px] shadow-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Relationship
                  </label>
                  <select
                    value={relRelation}
                    onChange={(e) => setRelRelation(e.target.value)}
                    className="w-full h-9 px-2 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 text-[13px] shadow-xs cursor-pointer"
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Spouse">Spouse / Partner</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Child">Child / Dependent</option>
                    <option value="Guardian">Legal Guardian</option>
                    <option value="Associate">Known Associate</option>
                    <option value="Other">Other Relative</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Contact Phone No
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={relPhone}
                      onChange={(e) => setRelPhone(formatIndianPhone(e.target.value))}
                      placeholder="+91 98765 43210"
                      className="w-full h-9 pl-8 pr-2 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 text-[13px] font-mono shadow-xs"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Aadhaar Card No
                  </label>
                  <div className="relative">
                    <CreditCard className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={relAadhaar}
                      onChange={(e) => setRelAadhaar(formatAadhaar(e.target.value))}
                      placeholder="12-digit Aadhaar"
                      maxLength={19}
                      className="w-full h-9 pl-8 pr-2 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 text-[13px] font-mono shadow-xs"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Handset IMEI No
                  </label>
                  <div className="relative">
                    <Smartphone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={relImei}
                      onChange={(e) => setRelImei(e.target.value)}
                      placeholder="15-digit IMEI"
                      maxLength={18}
                      className="w-full h-9 pl-8 pr-2.5 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 text-[13px] font-mono shadow-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <MapPin className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={relAddress}
                    onChange={(e) => setRelAddress(e.target.value)}
                    placeholder="Residential address / Current location (optional)"
                    className="w-full h-9 pl-8 pr-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 text-[13px] shadow-xs"
                  />
                </div>

                {/* Relative Photo Uploader */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {relPhotoUrl ? (
                    <div className="relative group">
                      <img
                        src={relPhotoUrl}
                        alt="Relative preview"
                        className="w-9 h-9 rounded-lg object-cover border border-[#E5E7EB] shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setRelPhotoUrl('')}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] hover:bg-rose-700 cursor-pointer shadow-xs"
                        title="Remove photo"
                      >
                        &times;
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => relFileInputRef.current?.click()}
                      className="h-9 px-3 bg-white hover:bg-neutral-100 text-neutral-700 border border-[#E5E7EB] text-[12px] font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
                      title="Upload relative photo"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#3B5B7A]" />
                      <span>Attach Photo</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleAddRelative}
                    className="h-9 px-4 bg-neutral-900 hover:bg-black text-white text-[12px] font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
                  >
                    <Plus className="w-4 h-4" /> Add Relative
                  </button>
                </div>
              </div>
            </div>

            {/* List of Added Relatives */}
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {(formData.relatives || []).length === 0 ? (
                <div className="text-[12px] text-neutral-500 italic py-1">
                  No relatives or emergency contacts recorded yet.
                </div>
              ) : (
                formData.relatives?.map((rel) => (
                  <div
                    key={rel.id}
                    className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg border border-[#E5E7EB] hover:bg-neutral-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {rel.photoUrl ? (
                        <img
                          src={rel.photoUrl}
                          alt={rel.name}
                          className="w-8 h-8 rounded-full object-cover border border-[#E5E7EB] shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 font-bold text-[11px] shrink-0">
                          {rel.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 shrink-0">
                        {rel.relation}
                      </span>
                      <span className="text-[13px] font-bold text-neutral-900 truncate">
                        {rel.name}
                      </span>
                      {rel.phone && (
                        <span className="text-[12px] font-mono text-neutral-600 flex items-center gap-1 shrink-0">
                          <Phone className="w-3 h-3 text-neutral-400" />
                          {rel.phone}
                        </span>
                      )}
                      {rel.aadhaar && (
                        <span className="text-[11px] font-mono text-slate-700 flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 shrink-0">
                          <CreditCard className="w-3 h-3 text-slate-500" />
                          Aadhaar: {rel.aadhaar}
                        </span>
                      )}
                      {rel.imei && (
                        <span className="text-[11px] font-mono text-purple-700 flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 shrink-0">
                          <Smartphone className="w-3 h-3 text-purple-500" />
                          IMEI: {rel.imei}
                        </span>
                      )}
                      {rel.address && (
                        <span className="text-[11px] text-neutral-500 truncate hidden md:inline">
                          • {rel.address}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveRelative(rel.id)}
                      className="text-neutral-400 hover:text-red-600 p-1 cursor-pointer transition-colors shrink-0 ml-2"
                      title="Remove Relative"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Social Media Details */}
          <div className="border-t border-[#E5E7EB] pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-4 h-4 text-slate-700" />
                <h4 className="text-[12px] font-bold text-neutral-800 uppercase tracking-wider">
                  Social Media &amp; Digital Handles
                </h4>
              </div>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-[#E5E7EB]">
                {(formData.socialMedia || []).length} Handles
              </span>
            </div>

            {/* Social Media Input Fields */}
            <div className="bg-[#F8F9FA] p-3.5 rounded-xl border border-[#E5E7EB] mb-3 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Platform
                  </label>
                  <select
                    value={smPlatform}
                    onChange={(e) => setSmPlatform(e.target.value)}
                    className="w-full h-9 px-2.5 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 text-[13px] shadow-xs cursor-pointer"
                  >
                    <optgroup label="Popular Social Networks">
                      <option value="Instagram">Instagram</option>
                      <option value="Facebook">Facebook</option>
                      <option value="X (Twitter)">X (Twitter)</option>
                      <option value="Threads">Threads</option>
                      <option value="TikTok">TikTok</option>
                      <option value="Snapchat">Snapchat</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Reddit">Reddit</option>
                      <option value="Pinterest">Pinterest</option>
                      <option value="Tumblr">Tumblr</option>
                    </optgroup>
                    <optgroup label="Instant & Encrypted Messaging">
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Telegram">Telegram</option>
                      <option value="Signal">Signal</option>
                      <option value="Discord">Discord</option>
                      <option value="WeChat">WeChat</option>
                      <option value="Viber">Viber</option>
                      <option value="LINE">LINE</option>
                      <option value="Session">Session</option>
                      <option value="Wickr">Wickr</option>
                      <option value="Skype">Skype</option>
                    </optgroup>
                    <optgroup label="Video, Live & Streaming">
                      <option value="YouTube">YouTube</option>
                      <option value="Twitch">Twitch</option>
                      <option value="Kick">Kick</option>
                      <option value="Rumble">Rumble</option>
                    </optgroup>
                    <optgroup label="Alternative, Regional & Other">
                      <option value="VK (VKontakte)">VK (VKontakte)</option>
                      <option value="Bluesky">Bluesky</option>
                      <option value="Mastodon">Mastodon</option>
                      <option value="Truth Social">Truth Social</option>
                      <option value="GitHub">GitHub</option>
                      <option value="OnlyFans">OnlyFans</option>
                      <option value="Other">Other Platform</option>
                    </optgroup>
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Username / Handle
                  </label>
                  <div className="relative">
                    <AtSign className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={smHandle}
                      onChange={(e) => setSmHandle(e.target.value)}
                      placeholder="@handle or username"
                      className="w-full h-9 pl-8 pr-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 text-[13px] shadow-xs font-mono"
                    />
                  </div>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                    Profile URL (Optional)
                  </label>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={smUrl}
                      onChange={(e) => setSmUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full h-9 pl-8 pr-3 border border-[#E5E7EB] rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white text-neutral-900 text-[13px] shadow-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddSocialMedia}
                  className="h-9 px-4 bg-neutral-900 hover:bg-black text-white text-[12px] font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Social Handle
                </button>
              </div>
            </div>

            {/* List of Added Social Media Accounts */}
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {(formData.socialMedia || []).length === 0 ? (
                <div className="text-[12px] text-neutral-500 italic py-1">
                  No social media accounts or digital handles recorded.
                </div>
              ) : (
                formData.socialMedia?.map((sm) => (
                  <div
                    key={sm.id}
                    className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-lg border border-[#E5E7EB] hover:bg-neutral-100/70 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                        {sm.platform}
                      </span>
                      <span className="font-mono text-[13px] font-bold text-neutral-900 truncate">
                        {sm.handle}
                      </span>
                      {sm.profileUrl && (
                        <a
                          href={sm.profileUrl.startsWith('http') ? sm.profileUrl : `https://${sm.profileUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[#3B5B7A] hover:underline flex items-center gap-1 shrink-0"
                        >
                          <LinkIcon className="w-3 h-3" />
                          Link
                        </a>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSocialMedia(sm.id)}
                      className="text-neutral-400 hover:text-red-600 p-1 cursor-pointer transition-colors shrink-0 ml-2"
                      title="Remove Social Media"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-[#E5E7EB] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-[#E5E7EB] rounded-lg text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer shadow-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-neutral-900 text-white text-[13px] font-bold rounded-lg hover:bg-black flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{editingProfile ? 'Save Changes' : 'Create Record'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
