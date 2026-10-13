import React from 'react';

interface Slot {
  id: string;
  name: string;
  color?: string;
  imageUrl?: string; // Gambar yang diupload MCX (full 1 potongan)
}

interface SpinWheelPreviewProps {
  slots: Slot[];
  tvBackgroundUrl?: string;
}

export default function SpinWheelPreview({ slots, tvBackgroundUrl }: SpinWheelPreviewProps) {
  if (!slots || slots.length === 0) {
    return (
      <div className="w-full aspect-video bg-slate-900 rounded-xl overflow-hidden relative flex items-center justify-center border-4 border-slate-800 shadow-2xl">
        <div className="w-64 h-64 rounded-full border-8 border-slate-700 bg-slate-800 flex items-center justify-center">
          <span className="text-slate-500 font-bold">Belum ada Slot</span>
        </div>
      </div>
    );
  }

  const numSlots = slots.length;
  // Jika hanya 1 slot, tidak bisa pakai arc, harus buat lingkaran penuh.
  const sliceAngle = numSlots > 1 ? 360 / numSlots : 360; 
  
  // Ukuran dasar kanvas SVG
  const radius = 50; 
  const center = 50; 

  // Fungsi matematika untuk mencari titik X, Y di tepi lingkaran
  const getCoordinatesForPercent = (angleInDegrees: number) => {
    // Kurangi 90 derajat supaya potongan pertama mulai persis dari angka 12 (atas)
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: center + (radius * Math.cos(angleInRadians)),
      y: center + (radius * Math.sin(angleInRadians))
    };
  };

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden relative flex items-center justify-center border-4 border-slate-800 shadow-2xl group">
      
      {/* 1. Latar Belakang TV */}
      {tvBackgroundUrl ? (
        <img 
          src={tvBackgroundUrl} 
          alt="TV Background" 
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-80"
        />
      ) : (
        <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-900 to-slate-900 z-0"></div>
      )}

      <div className="absolute inset-0 bg-black/20 z-10"></div>

      {/* 2. Komponen Roda */}
      <div className="relative z-20 w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96">
        
        {/* Jarum Penunjuk */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-yellow-400 drop-shadow-md z-30 filter"></div>

        {/* Bodi Roda - Menggunakan SVG */}
        <div className="w-full h-full rounded-full border-[12px] border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative backdrop-blur-sm bg-slate-800">
          
          <svg viewBox="0 0 100 100" className="w-full h-full transform">
            <defs>
              {/* Deklarasikan semua gambar dari MCX sebagai pattern yang bisa dipakai mengisi irisan */}
              {slots.map((slot, index) => {
                if (slot.imageUrl) {
                  return (
                    <pattern id={`img-${slot.id}`} key={`pat-${slot.id}`} x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                      <image href={slot.imageUrl} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" />
                    </pattern>
                  );
                }
                return null;
              })}
            </defs>

            {/* Gambar setiap irisan (Slice) */}
            {slots.map((slot, index) => {
              if (numSlots === 1) {
                 // Kasus khusus kalau slot cuma 1 (lingkaran penuh)
                 return (
                   <circle 
                     key={slot.id} 
                     cx="50" cy="50" r="50" 
                     fill={slot.imageUrl ? `url(#img-${slot.id})` : slot.color || '#4f46e5'} 
                   />
                 );
              }

              const startAngle = index * sliceAngle;
              const endAngle = startAngle + sliceAngle;

              // Titik mulai dan selesai dari irisan ini di sisi luar lingkaran
              const startCoord = getCoordinatesForPercent(startAngle);
              const endCoord = getCoordinatesForPercent(endAngle);

              // Flag apakah sudutnya lebih dari 180 derajat (kasus kalau slot cuma 2 atau 1)
              const largeArcFlag = sliceAngle > 180 ? 1 : 0;

              // D: Perintah untuk menggambar bentuk. 
              // M = Move (Mulai dari tengah). L = Line (Tarik garis ke tepi). 
              // A = Arc (Tarik garis lengkung luar). Z = Close (Tutup kembali ke tengah).
              const pathData = [
                `M ${center} ${center}`,
                `L ${startCoord.x} ${startCoord.y}`,
                `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endCoord.x} ${endCoord.y}`,
                `Z`
              ].join(' ');

              return (
                <path
                  key={slot.id}
                  d={pathData}
                  fill={slot.imageUrl ? `url(#img-${slot.id})` : slot.color || '#4f46e5'}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="0.5"
                />
              );
            })}
          </svg>

        </div>
        
        {/* Titik Tengah Roda (Poros) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full border-4 border-slate-300 shadow-inner z-30 flex items-center justify-center">
           <div className="w-4 h-4 bg-slate-800 rounded-full"></div>
        </div>

      </div>
      
      {/* Label Keterangan */}
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 z-20">
        <span className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> Preview TV Monitor
        </span>
      </div>

    </div>
  );
}