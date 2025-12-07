import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePageTitle } from '@/hooks/use-page-title';
import { lazy, Suspense } from 'react';
import type { CarouselApi } from '@/components/ui/carousel';
import { motion, AnimatePresence, useInView } from 'framer-motion';

// Lazy load non-critical components for better initial load performance
const ContactForm = lazy(() => import('@/components/contact-form'));
import oficazWhiteLogo from '@assets/Imagotipo Oficaz white_1750407614936.png';
// Optimized icon imports - critical and frequently used icons
import { 
  Clock, 
  Users, 
  CheckCircle,
  XCircle,
  ArrowRight,
  Play,
  ChevronLeft,
  ChevronRight,
  Star,
  Calendar,
  CalendarDays,
  FileText,
  MessageSquare,
  Shield,
  TrendingUp,
  Building2,
  Smartphone,
  Globe,
  Mail,
  Settings,
  Zap,
  CreditCard,
  Bell,
  Square,
  Eye,
  Phone,
  MapPin,
  Edit,
  Trash2,
  Search,
  PenLine,
  Plane,
  Stethoscope,
  Baby,
  Heart,
  Briefcase,
  GraduationCap,
  Scale
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';

import oficazLogo from '@assets/Imagotipo Oficaz_1750321812493.png';
import heroBackground from '@assets/oficaz_hero_1764771312944.webp';

// Avatar images for employee preview (optimized thumbnails)
import avatarMan01 from '@assets/man01_thumb.webp';
import avatarMan02 from '@assets/man02_thumb.webp';
import avatarMan03 from '@assets/man03_thumb.webp';
import avatarMan04 from '@assets/man04_thumb.webp';
import avatarWoman01 from '@assets/woman01_thumb.webp';
import avatarWoman02 from '@assets/woman02_thumb.webp';
import avatarWoman03 from '@assets/woman03_thumb.webp';

// Apple-style scroll animation component
function ScrollReveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ 
        duration: 0.8, 
        delay: delay,
        ease: [0.25, 0.1, 0.25, 1] // Apple-style easing
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Extended addon descriptions for desktop carousel
const addonExtendedDescriptions: Record<string, string> = {
  employees: "Centraliza toda la información de tu equipo en un solo lugar. Alta y baja de empleados, gestión de datos personales, asignación de roles y permisos, histórico de cambios y acceso seguro para cada miembro según su nivel.",
  time_tracking: "Cumple con la normativa de registro horario de forma sencilla. Tus empleados fichan en dos toques desde el móvil, y tú obtienes informes detallados en PDF listos para inspección. Control total sin complicaciones.",
  vacation: "Olvídate del caos de las hojas de cálculo. Cada empleado ve sus días disponibles, solicita fechas con un clic, y tú apruebas o rechazas al instante. Calendario visual para evitar solapamientos.",
  schedules: "Planifica turnos arrastrando y soltando. Duplica semanas enteras, crea plantillas reutilizables, y con OficazIA genera cuadrantes optimizados en segundos. Tu equipo recibe notificaciones automáticas.",
  messages: "Mantén la comunicación profesional separada del WhatsApp personal. Crea grupos por departamento, envía anuncios a toda la empresa, y guarda historial de conversaciones importantes.",
  reminders: "Configura alertas para ti o para cualquier empleado. Notificaciones push que llegan aunque la app esté cerrada. Perfectas para fechas límite, renovaciones de contratos o tareas recurrentes.",
  documents: "Sube nóminas, contratos, certificados y cualquier documento. Organización automática por empleado y categoría. Firma digital integrada y acceso controlado según permisos.",
  work_reports: "Ideal para servicios técnicos y trabajo en campo. Tus empleados documentan cada trabajo con fotos, ubicación GPS y descripción. El cliente firma en pantalla y se genera un PDF profesional.",
  ai_assistant: "Tu asistente inteligente disponible 24/7. Dile 'crea el horario de esta semana' y lo hace. Pregúntale 'cuántas horas trabajó Ana en octubre' y te responde al instante. Gestión por voz o texto."
};

function DifficultySlider({ onSelect }: { onSelect?: (option: 'dificil' | 'normal' | 'oficaz') => void }) {
  const [selected, setSelected] = useState<'dificil' | 'normal' | 'oficaz'>('normal');
  const [, navigate] = useLocation();
  
  const handleSelect = (option: 'dificil' | 'normal' | 'oficaz') => {
    setSelected(option);
    onSelect?.(option);
    if (option === 'oficaz') {
      setTimeout(() => {
        navigate('/request-code');
      }, 400);
    }
  };
  
  return (
    <div className="relative inline-flex bg-white/10 backdrop-blur-md rounded-2xl p-1.5 border border-white/20">
      {/* Sliding background indicator */}
      <div 
        className="absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-300 ease-out"
        style={{
          width: 'calc(33.333% - 4px)',
          left: selected === 'dificil' ? '6px' : selected === 'normal' ? 'calc(33.333% + 2px)' : 'calc(66.666% - 2px)',
          background: selected === 'oficaz' 
            ? 'linear-gradient(135deg, #007AFF 0%, #0066DD 100%)' 
            : selected === 'dificil'
            ? 'rgba(239, 68, 68, 0.3)'
            : 'rgba(255, 255, 255, 0.15)',
          boxShadow: selected === 'oficaz' ? '0 4px 20px rgba(0, 122, 255, 0.4)' : 'none'
        }}
      />
      
      {/* Options */}
      <button
        onClick={() => handleSelect('dificil')}
        className={`relative z-10 px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 ${
          selected === 'dificil' 
            ? 'text-red-400' 
            : 'text-white/60 hover:text-white/80'
        }`}
      >
        Difícil
      </button>
      
      <button
        onClick={() => handleSelect('normal')}
        className={`relative z-10 px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 ${
          selected === 'normal' 
            ? 'text-white' 
            : 'text-white/60 hover:text-white/80'
        }`}
      >
        Normal
      </button>
      
      <button
        onClick={() => handleSelect('oficaz')}
        className={`relative z-10 px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-sm sm:text-base font-bold transition-all duration-300 ${
          selected === 'oficaz' 
            ? 'text-white' 
            : 'text-white/60 hover:text-white/80'
        }`}
      >
        Oficaz
      </button>
    </div>
  );
}

// Reusable component for mobile preview content in both carousel and desktop
function MobilePreviewContent({ addonKey }: { addonKey: string }) {
  if (addonKey === 'time_tracking') {
    return (
      <div className="p-3 h-full bg-[#0a1628]">
        <h3 className="text-white font-bold text-sm mb-0.5">Control de Tiempo</h3>
        <p className="text-gray-400 text-[8px] mb-3">Revisa tu historial de fichajes</p>
        
        <div className="flex items-center justify-center gap-3 mb-3">
          <ChevronLeft className="w-3 h-3 text-gray-400" />
          <span className="text-white text-[10px] font-medium">octubre 2025</span>
          <ChevronRight className="w-3 h-3 text-gray-400" />
        </div>
        
        <div className="bg-[#1a2942] rounded-xl p-3 mb-3">
          <p className="text-gray-400 text-[8px] text-center mb-1">Total del mes</p>
          <p className="text-white font-bold text-lg text-center">160h 45m</p>
          
          <div className="flex justify-between mt-3 gap-1">
            {[
              { month: 'jul', hours: '162h', active: false },
              { month: 'ago', hours: '158h', active: false },
              { month: 'sep', hours: '165h', active: false },
              { month: 'oct', hours: '160h', active: true },
            ].map((m, i) => (
              <div key={i} className={`flex-1 rounded-lg p-1.5 ${m.active ? 'bg-[#007AFF]/30 border border-[#007AFF]' : 'bg-[#0a1628]'}`}>
                <div className="h-6 bg-[#007AFF] rounded-t-sm mb-1"></div>
                <p className="text-gray-400 text-[7px] text-center">{m.month}</p>
                <p className="text-white text-[7px] text-center font-medium">{m.hours}</p>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-[#1a2942] rounded-xl p-2">
          <div className="flex justify-between items-center mb-2">
            <p className="text-white text-[8px]">octubre semana del 27-02</p>
            <span className="bg-[#007AFF]/20 text-[#007AFF] text-[7px] font-medium px-1.5 py-0.5 rounded">40h 12m</span>
          </div>
          <div className="space-y-1.5">
            {[
              { day: 'viernes', num: '31', hours: '8h 28m', breakPos: 60 },
              { day: 'jueves', num: '30', hours: '8h 29m', breakPos: 55 },
            ].map((entry, i) => (
              <div key={i} className="bg-[#0a1628] rounded-md p-1.5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-white text-[7px] font-medium">{entry.day} {entry.num}</span>
                  <span className="text-gray-400 text-[7px]">{entry.hours}</span>
                </div>
                <div className="relative h-2.5 bg-[#007AFF] rounded-full">
                  <div className="absolute top-1/2 w-1.5 h-1.5 bg-orange-400 rounded-full" style={{ left: `${entry.breakPos}%`, transform: 'translate(-50%, -50%)' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (addonKey === 'vacation') {
    return (
      <div className="p-3 h-full bg-[#0a1628]">
        <h3 className="text-white font-bold text-sm mb-0.5">Ausencias</h3>
        <p className="text-gray-400 text-[8px] mb-2">Solicita y consulta el estado</p>
        
        {/* Summary card */}
        <div className="bg-white/5 rounded-xl p-2 mb-2 border border-white/10">
          <div className="grid grid-cols-3 gap-1 text-center mb-2">
            <div>
              <p className="text-blue-400 font-light text-base">30</p>
              <p className="text-gray-400 text-[6px] uppercase">Total</p>
            </div>
            <div>
              <p className="text-orange-400 font-light text-base">26</p>
              <p className="text-gray-400 text-[6px] uppercase">Usados</p>
            </div>
            <div>
              <p className="text-green-400 font-light text-base">4</p>
              <p className="text-gray-400 text-[6px] uppercase">Disponibles</p>
            </div>
          </div>
          <div className="flex justify-between items-center mb-1">
            <p className="text-gray-400 text-[7px]">Progreso anual</p>
            <p className="text-gray-400 text-[7px]">86.7%</p>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div className="bg-[#007AFF] h-1.5 rounded-full" style={{ width: '87%' }}></div>
          </div>
        </div>
        
        <button className="w-full bg-[#007AFF] rounded-xl p-1.5 mb-2 flex items-center justify-center gap-1">
          <Calendar className="w-3 h-3 text-white" />
          <span className="text-white text-[7px] font-medium">Solicitar Ausencia</span>
        </button>
        
        {/* Request cards - new Apple style */}
        <div className="space-y-1.5">
          {[
            { type: 'Vacaciones', period: '10 dic → 12 dic', days: '3', status: 'approved', icon: 'vacation', iconColor: 'bg-green-500/20', iconTextColor: 'text-green-400' },
            { type: 'Permiso paternidad', period: '1 nov → 15 nov', days: '15', status: 'approved', icon: 'baby', iconColor: 'bg-pink-500/20', iconTextColor: 'text-pink-400' },
            { type: 'Baja médica', period: '5 de noviembre', days: '1', status: 'pending', icon: 'medical', iconColor: 'bg-red-500/20', iconTextColor: 'text-red-400' },
            { type: 'Asuntos propios', period: '20 de octubre', days: '1', status: 'approved', icon: 'briefcase', iconColor: 'bg-blue-500/20', iconTextColor: 'text-blue-400' },
          ].map((req, i) => {
            const IconComponent = req.icon === 'vacation' ? Plane : 
                                  req.icon === 'medical' ? Stethoscope :
                                  req.icon === 'baby' ? Baby :
                                  Briefcase;
            return (
              <div key={i} className="bg-white/5 rounded-lg overflow-hidden border border-white/10 flex">
                <div className="flex-1 p-1.5 flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center ${req.iconColor}`}>
                    <IconComponent className={`w-2.5 h-2.5 ${req.iconTextColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[7px] font-medium">{req.type}</p>
                    <p className="text-gray-400 text-[5px]">{req.period} • {req.days} día{Number(req.days) > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className={`w-8 flex flex-col items-center justify-center ${
                  req.status === 'approved' ? 'bg-green-500/10' : 
                  req.status === 'rejected' ? 'bg-red-500/10' : 
                  'bg-amber-500/10'
                }`}>
                  {req.status === 'approved' && <CheckCircle className="w-2.5 h-2.5 text-green-400" />}
                  {req.status === 'rejected' && <XCircle className="w-2.5 h-2.5 text-red-400" />}
                  {req.status === 'pending' && <Clock className="w-2.5 h-2.5 text-amber-400" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  
  if (addonKey === 'employees') {
    return (
      <div className="p-3 h-full bg-[#0a1628]">
        <h3 className="text-white font-bold text-sm mb-0.5">Mi Equipo</h3>
        <p className="text-gray-400 text-[8px] mb-2">Gestiona tu plantilla</p>
        
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-2 text-center">
            <p className="text-purple-400 font-bold text-sm">1</p>
            <p className="text-purple-300/70 text-[6px]">Admin</p>
          </div>
          <div className="bg-[#007AFF]/20 border border-[#007AFF]/30 rounded-lg p-2 text-center">
            <p className="text-[#007AFF] font-bold text-sm">1</p>
            <p className="text-blue-300/70 text-[6px]">Manager</p>
          </div>
          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-2 text-center">
            <p className="text-green-400 font-bold text-sm">10</p>
            <p className="text-green-300/70 text-[6px]">Empleados</p>
          </div>
        </div>
        
        <button className="w-full bg-[#007AFF] rounded-lg p-2 mb-2 flex items-center justify-center gap-1.5">
          <Users className="w-3 h-3 text-white" />
          <span className="text-white text-[8px] font-semibold">Crear usuario</span>
        </button>
        
        <div className="space-y-1">
          {[
            { name: 'María García', role: 'Admin', avatar: avatarWoman01, roleColor: 'text-purple-400' },
            { name: 'Carlos López', role: 'Manager', avatar: avatarMan01, roleColor: 'text-[#007AFF]' },
            { name: 'Ana Martín', role: 'Empleado', avatar: avatarWoman02, roleColor: 'text-green-400' },
            { name: 'Pedro Ruiz', role: 'Empleado', avatar: avatarMan02, roleColor: 'text-green-400' },
            { name: 'Laura Sanz', role: 'Empleado', avatar: avatarWoman03, roleColor: 'text-green-400' },
          ].map((emp, i) => (
            <div key={i} className="bg-[#1a2942] rounded-lg p-1.5 flex items-center gap-2">
              <img 
                src={emp.avatar} 
                alt={emp.name}
                className="w-6 h-6 rounded-full object-cover"
              />
              <div className="flex-1">
                <p className="text-white text-[7px] font-medium">{emp.name}</p>
                <p className={`text-[6px] ${emp.roleColor}`}>{emp.role}</p>
              </div>
              <Settings className="w-2.5 h-2.5 text-gray-500" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (addonKey === 'schedules') {
    return (
      <div className="p-3 h-full bg-[#0a1628] flex flex-col">
        <h3 className="text-white font-bold text-sm mb-0.5">Cuadrante</h3>
        <p className="text-gray-400 text-[8px] mb-1.5">Consulta tus turnos asignados</p>
        
        <div className="bg-[#1a2942] rounded-lg p-1.5 mb-2 flex items-center justify-between">
          <ChevronLeft className="w-2.5 h-2.5 text-gray-500" />
          <span className="text-white text-[7px] font-medium">Semana 29 - 5 oct</span>
          <ChevronRight className="w-2.5 h-2.5 text-gray-500" />
        </div>
        
        <div className="flex-1 space-y-2">
          {/* Lunes - 2 turnos */}
          <div className="bg-[#1a2942] rounded-xl p-2">
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-white text-[8px] font-semibold">Lunes <span className="text-gray-400 font-normal">29 sep</span></p>
              <p className="text-gray-500 text-[6px]">2 turnos</p>
            </div>
            <div className="space-y-1.5">
              <div className="bg-red-500 rounded-md px-2 py-1.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-white text-[7px] font-medium">Mañana</span>
                  <span className="text-white/80 text-[6px]">09:00-14:00</span>
                </div>
                <div className="flex items-center gap-1 text-white/90">
                  <MapPin className="w-2 h-2" />
                  <span className="text-[5px]">Oficina Central</span>
                </div>
              </div>
              <div className="bg-green-500 rounded-md px-2 py-1.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-white text-[7px] font-medium">Tarde</span>
                  <span className="text-white/80 text-[6px]">15:00-20:00</span>
                </div>
                <div className="flex items-center gap-1 text-white/90">
                  <MapPin className="w-2 h-2" />
                  <span className="text-[5px]">Cliente ABC S.L.</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Martes */}
          <div className="bg-[#1a2942] rounded-xl p-2">
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-white text-[8px] font-semibold">Martes <span className="text-gray-400 font-normal">30 sep</span></p>
              <p className="text-gray-500 text-[6px]">1 turno</p>
            </div>
            <div className="bg-[#007AFF] rounded-md px-2 py-1.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-white text-[7px] font-medium">Completo</span>
                <span className="text-white/80 text-[6px]">08:00-17:00</span>
              </div>
              <div className="flex items-center gap-1 text-white/90">
                <MapPin className="w-2 h-2" />
                <span className="text-[5px]">Almacén Norte</span>
              </div>
            </div>
          </div>
          
          {/* Miércoles */}
          <div className="bg-[#1a2942] rounded-xl p-2">
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-white text-[8px] font-semibold">Miércoles <span className="text-gray-400 font-normal">1 oct</span></p>
              <p className="text-gray-500 text-[6px]">1 turno</p>
            </div>
            <div className="bg-purple-500 rounded-md px-2 py-1.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-white text-[7px] font-medium">Noche</span>
                <span className="text-white/80 text-[6px]">22:00-06:00</span>
              </div>
              <div className="flex items-center gap-1 text-white/90">
                <MapPin className="w-2 h-2" />
                <span className="text-[5px]">Fábrica Sur</span>
              </div>
            </div>
          </div>
          
          {/* Jueves */}
          <div className="bg-[#1a2942] rounded-xl p-2">
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-white text-[8px] font-semibold">Jueves <span className="text-gray-400 font-normal">2 oct</span></p>
              <p className="text-gray-500 text-[6px]">1 turno</p>
            </div>
            <div className="bg-orange-500 rounded-md px-2 py-1.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-white text-[7px] font-medium">Mañana</span>
                <span className="text-white/80 text-[6px]">07:00-15:00</span>
              </div>
              <div className="flex items-center gap-1 text-white/90">
                <MapPin className="w-2 h-2" />
                <span className="text-[5px]">Sede Principal</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (addonKey === 'messages') {
    return (
      <div className="p-3 h-full bg-[#0a1628]">
        <h3 className="text-white font-bold text-sm mb-0.5">Mensajes</h3>
        <p className="text-gray-400 text-[8px] mb-3">Conversaciones</p>
        <div className="bg-[#1a2942] rounded-xl overflow-hidden">
          {[
            { name: 'Equipo', msg: 'Reunión mañana a las 10', time: '10:30', unread: 3 },
            { name: 'Carlos', msg: 'Terminé el informe', time: '09:15', unread: 0 },
            { name: 'RRHH', msg: 'Recordatorio vacaciones', time: 'Ayer', unread: 1 },
            { name: 'Ana', msg: 'Documento actualizado', time: 'Ayer', unread: 0 },
          ].map((chat, i) => (
            <div key={i} className="p-2 flex items-center gap-2 border-b border-[#0a1628] last:border-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#007AFF] to-blue-600 flex items-center justify-center text-white text-[8px] font-bold">
                {chat.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <p className="text-white text-[8px] font-medium truncate">{chat.name}</p>
                  <span className="text-gray-500 text-[6px]">{chat.time}</span>
                </div>
                <p className="text-gray-400 text-[6px] truncate">{chat.msg}</p>
              </div>
              {chat.unread > 0 && (
                <span className="w-4 h-4 bg-[#007AFF] rounded-full text-white text-[6px] flex items-center justify-center">{chat.unread}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (addonKey === 'reminders') {
    return (
      <div className="p-3 h-full bg-[#0a1628]">
        <h3 className="text-white font-bold text-sm mb-0.5">Recordatorios</h3>
        <p className="text-gray-400 text-[8px] mb-2">Gestiona tus tareas</p>
        
        <div className="flex gap-1.5 mb-2">
          <div className="flex-1 bg-[#1a2942] rounded-lg px-2 py-1">
            <p className="text-gray-500 text-[5px]">Buscar...</p>
          </div>
          <div className="bg-[#007AFF] rounded-lg px-2 py-1">
            <p className="text-white text-[5px]">+ Crear</p>
          </div>
        </div>
        
        <div className="space-y-1.5">
          {/* Card 1 - Alta prioridad (rosa suave) - compartido */}
          <div className="bg-pink-50 rounded-xl p-2 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-pink-500 text-[6px] font-medium">Alta</span>
              <div className="flex items-center gap-1">
                <Bell className="w-2 h-2 text-gray-400" />
                <Users className="w-2 h-2 text-gray-400" />
                <Edit className="w-2 h-2 text-gray-400" />
                <Trash2 className="w-2 h-2 text-gray-400" />
              </div>
            </div>
            <p className="text-gray-900 text-[7px] font-semibold">Renovar contrato proveedor</p>
            <p className="text-gray-600 text-[5px] mt-0.5">Revisar condiciones y firmar antes del día 15</p>
            <div className="flex items-center gap-1 mt-1 text-pink-400">
              <Calendar className="w-2 h-2" />
              <span className="text-[5px]">Mañana</span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <div className="flex -space-x-1">
                <img src={avatarWoman01} alt="" className="w-4 h-4 rounded-full border-2 border-pink-50 object-cover" />
                <img src={avatarMan01} alt="" className="w-4 h-4 rounded-full border-2 border-pink-50 object-cover" />
              </div>
              <button className="flex items-center gap-0.5 text-gray-500 text-[5px]">
                <div className="w-2.5 h-2.5 rounded-full border border-gray-400"></div>
                Completar
              </button>
            </div>
          </div>
          
          {/* Card 2 - Media prioridad (amarillo suave) - sin compartir */}
          <div className="bg-yellow-50 rounded-xl p-2 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-yellow-600 text-[6px] font-medium">Media</span>
              <div className="flex items-center gap-1">
                <Bell className="w-2 h-2 text-gray-400" />
                <Users className="w-2 h-2 text-gray-400" />
                <Edit className="w-2 h-2 text-gray-400" />
                <Trash2 className="w-2 h-2 text-gray-400" />
              </div>
            </div>
            <p className="text-gray-900 text-[7px] font-semibold">Enviar nóminas noviembre</p>
            <div className="flex items-center gap-1 mt-1 text-yellow-500">
              <Calendar className="w-2 h-2" />
              <span className="text-[5px]">Hace 2 días</span>
            </div>
            <div className="flex items-center justify-end mt-1.5">
              <button className="flex items-center gap-0.5 text-gray-500 text-[5px]">
                <div className="w-2.5 h-2.5 rounded-full border border-gray-400"></div>
                Completar
              </button>
            </div>
          </div>
          
          {/* Card 3 - Baja prioridad (verde suave) - compartido con 1 persona */}
          <div className="bg-green-50 rounded-xl p-2 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-green-600 text-[6px] font-medium">Baja</span>
              <div className="flex items-center gap-1">
                <Bell className="w-2 h-2 text-gray-400" />
                <Users className="w-2 h-2 text-gray-400" />
                <Edit className="w-2 h-2 text-gray-400" />
                <Trash2 className="w-2 h-2 text-gray-400" />
              </div>
            </div>
            <p className="text-gray-900 text-[7px] font-semibold">Revisión equipos oficina</p>
            <div className="flex items-center gap-1 mt-1 text-green-500">
              <Calendar className="w-2 h-2" />
              <span className="text-[5px]">Próxima semana</span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <div className="flex -space-x-1">
                <img src={avatarMan02} alt="" className="w-4 h-4 rounded-full border-2 border-green-50 object-cover" />
              </div>
              <button className="flex items-center gap-0.5 text-gray-500 text-[5px]">
                <div className="w-2.5 h-2.5 rounded-full border border-gray-400"></div>
                Completar
              </button>
            </div>
          </div>
          
          {/* Card 4 - Media prioridad (amarillo suave) - sin compartir */}
          <div className="bg-yellow-50 rounded-xl p-2 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-yellow-600 text-[6px] font-medium">Media</span>
              <div className="flex items-center gap-1">
                <Bell className="w-2 h-2 text-gray-400" />
                <Users className="w-2 h-2 text-gray-400" />
                <Edit className="w-2 h-2 text-gray-400" />
                <Trash2 className="w-2 h-2 text-gray-400" />
              </div>
            </div>
            <p className="text-gray-900 text-[7px] font-semibold">Llamar gestoría fiscal</p>
            <div className="flex items-center gap-1 mt-1 text-yellow-500">
              <Calendar className="w-2 h-2" />
              <span className="text-[5px]">Viernes</span>
            </div>
            <div className="flex items-center justify-end mt-1.5">
              <button className="flex items-center gap-0.5 text-gray-500 text-[5px]">
                <div className="w-2.5 h-2.5 rounded-full border border-gray-400"></div>
                Completar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (addonKey === 'documents') {
    return (
      <div className="p-3 h-full bg-[#0a1628]">
        <h3 className="text-white font-bold text-sm mb-0.5">Documentos</h3>
        <p className="text-gray-400 text-[8px] mb-2">Gestiona tus documentos laborales</p>
        
        {/* Category tabs - 2 rows */}
        <div className="flex gap-1 mb-1">
          <div className="flex-1 bg-[#007AFF] rounded-lg py-1 px-1 flex items-center justify-center gap-0.5">
            <FileText className="w-2 h-2 text-white" />
            <span className="text-white text-[5px] font-medium">Todos</span>
          </div>
          <div className="flex-1 bg-[#1a2942] rounded-lg py-1 px-1 flex items-center justify-center gap-0.5">
            <CreditCard className="w-2 h-2 text-gray-400" />
            <span className="text-gray-400 text-[5px]">Nóminas</span>
          </div>
        </div>
        <div className="flex gap-1 mb-2">
          <div className="flex-1 bg-[#1a2942] rounded-lg py-1 px-1 flex items-center justify-center gap-0.5">
            <FileText className="w-2 h-2 text-gray-400" />
            <span className="text-gray-400 text-[5px]">Contratos</span>
          </div>
          <div className="flex-1 bg-[#1a2942] rounded-lg py-1 px-1 flex items-center justify-center gap-0.5">
            <FileText className="w-2 h-2 text-gray-400" />
            <span className="text-gray-400 text-[5px]">Otros...</span>
          </div>
        </div>
        
        {/* Search bar */}
        <div className="flex items-center gap-2 bg-[#1a2942] rounded-lg px-2 py-1 mb-2">
          <Search className="w-2.5 h-2.5 text-gray-500" />
          <span className="text-gray-500 text-[5px] flex-1">Buscar documentos...</span>
          <span className="text-gray-400 text-[5px]">6 docs</span>
        </div>
        
        <div className="bg-[#1a2942] rounded-xl overflow-hidden">
          {[
            { name: 'Nómina Noviembre 2025', type: 'Nómina', signed: false, size: '120 KB', date: '24 nov' },
            { name: 'Nómina Octubre 2025', type: 'Nómina', signed: true, size: '118 KB', date: '25 oct' },
            { name: 'Nómina Septiembre 2025', type: 'Nómina', signed: true, size: '115 KB', date: '26 sep' },
            { name: 'Nómina Agosto 2025', type: 'Nómina', signed: true, size: '122 KB', date: '25 ago' },
            { name: 'Contrato trabajo', type: 'Documento', signed: true, size: '1.2 MB', date: '15 ene' },
          ].map((doc, i) => (
            <div key={i} className="p-2 flex items-center gap-2 border-b border-[#0a1628] last:border-0">
              <div className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <FileText className="w-3 h-3 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[7px] font-medium truncate">{doc.name}</p>
                <div className="flex items-center gap-1">
                  <span className="text-orange-400 text-[6px]">{doc.type}</span>
                  <span className={`text-[6px] ${doc.signed ? 'text-green-400' : 'text-yellow-400'}`}>
                    {doc.signed ? '✓ Firmada' : ''}
                  </span>
                </div>
                <p className="text-gray-500 text-[5px]">{doc.size} · {doc.date}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Eye className="w-2.5 h-2.5 text-gray-500" />
                {!doc.signed ? (
                  <PenLine className="w-2.5 h-2.5 text-[#007AFF]" />
                ) : (
                  <ArrowRight className="w-2.5 h-2.5 text-gray-500 rotate-90" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (addonKey === 'work_reports') {
    return (
      <div className="p-3 h-full bg-[#0a1628]">
        <h3 className="text-white font-bold text-sm mb-0.5">Partes de Trabajo</h3>
        <p className="text-gray-400 text-[8px] mb-2">Documenta tus servicios</p>
        <div className="bg-[#1a2942] rounded-xl p-2 mb-3 space-y-2">
          <div className="p-1.5 bg-[#0a1628] rounded-lg">
            <p className="text-gray-500 text-[6px]">Cliente</p>
            <p className="text-white text-[7px]">Empresa ABC S.L.</p>
          </div>
          <div className="p-1.5 bg-[#0a1628] rounded-lg">
            <p className="text-gray-500 text-[6px]">Ubicación</p>
            <p className="text-white text-[7px]">📍 Calle Mayor, 15</p>
          </div>
          <div className="p-1.5 bg-[#0a1628] rounded-lg">
            <p className="text-gray-500 text-[6px]">Descripción</p>
            <p className="text-white text-[7px]">Instalación sistema eléctrico</p>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {['📸', '📸', '+'].map((icon, i) => (
              <div key={i} className="aspect-square bg-[#0a1628] rounded-lg flex items-center justify-center text-gray-500 text-sm">
                {icon}
              </div>
            ))}
          </div>
        </div>
        <button className="w-full bg-green-500 rounded-xl p-2 text-center">
          <p className="text-white font-semibold text-[7px]">✍️ Firmar y enviar</p>
        </button>
      </div>
    );
  }
  
  if (addonKey === 'ai_assistant') {
    return (
      <div className="p-3 h-full bg-[#0a1628] flex flex-col">
        <h3 className="text-white font-bold text-sm mb-0.5">OficazIA</h3>
        <p className="text-gray-400 text-[8px] mb-2">Tu asistente inteligente</p>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {/* Usuario mensaje 1 */}
          <div className="flex justify-end">
            <div className="bg-[#007AFF] rounded-xl rounded-tr-sm p-2 max-w-[88%]">
              <p className="text-white text-[8px] leading-relaxed">Ramírez tiene que trabajar la semana que viene de 9 a 14 y Marta hace los turnos de tarde</p>
            </div>
          </div>
          {/* IA respuesta 1 */}
          <div className="flex gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <Zap className="w-2.5 h-2.5 text-white" />
            </div>
            <div className="bg-[#1a2942] rounded-xl rounded-tl-sm p-2 max-w-[85%]">
              <p className="text-white text-[8px] leading-relaxed">¿El turno de Marta de 15 a 20? Recuerda que el viernes Marta está ausente, podría cubrirlo Marcos 🤔</p>
            </div>
          </div>
          {/* Usuario mensaje 2 */}
          <div className="flex justify-end">
            <div className="bg-[#007AFF] rounded-xl rounded-tr-sm p-2 max-w-[88%]">
              <p className="text-white text-[8px]">¡Exacto!</p>
            </div>
          </div>
          {/* IA respuesta 2 */}
          <div className="flex gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
              <Zap className="w-2.5 h-2.5 text-white" />
            </div>
            <div className="bg-[#1a2942] rounded-xl rounded-tl-sm p-2 max-w-[85%]">
              <p className="text-white text-[8px]">✅ Turnos creados:</p>
              <p className="text-gray-400 text-[7px] mt-0.5">• Ramírez: L-V 9:00-14:00</p>
              <p className="text-gray-400 text-[7px]">• Marta: L-J 15:00-20:00</p>
              <p className="text-gray-400 text-[7px]">• Marcos: V 15:00-20:00</p>
            </div>
          </div>
        </div>
        <div className="mt-2 flex gap-1.5">
          <input 
            type="text" 
            placeholder="Escribe..."
            className="flex-1 bg-[#1a2942] rounded-full px-3 py-1.5 text-[7px] text-white border border-[#2a3952] placeholder-gray-500"
            readOnly
          />
          <button className="w-6 h-6 bg-[#007AFF] rounded-full flex items-center justify-center">
            <ArrowRight className="w-3 h-3 text-white" />
          </button>
        </div>
      </div>
    );
  }
  
  return null;
}

export default function Landing() {
  usePageTitle('Bienvenido a Oficaz');
  const [isScrolled, setIsScrolled] = useState(false);
  const [isContactFormOpen, setIsContactFormOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [previewAddon, setPreviewAddon] = useState<string>('time_tracking');
  const [difficultyMode, setDifficultyMode] = useState<'dificil' | 'normal' | 'oficaz'>('normal');

  // Pricing calculator state - starts with 1 admin (required), employees (always included) and time_tracking selected
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set(['employees', 'time_tracking']));
  const [userCounts, setUserCounts] = useState({ employees: 0, managers: 0, admins: 1 });

  // Defer API calls until after critical content renders
  const [shouldLoadData, setShouldLoadData] = useState(false);
  
  useEffect(() => {
    // Trigger entrance animations after mount
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    // Defer data loading to prevent blocking initial render
    const timer = setTimeout(() => setShouldLoadData(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Track landing page visit
  useEffect(() => {
    const trackVisit = async () => {
      try {
        await fetch('/api/track/landing-visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referrer: document.referrer || '',
          }),
        });
      } catch (error) {
        console.error('Failed to track visit:', error);
      }
    };
    
    trackVisit();
  }, []);

  // Check if public registration is enabled - defer after critical content loads
  const { data: registrationSettings } = useQuery({
    queryKey: ['/api/registration-status'],
    queryFn: async () => {
      const response = await fetch('/api/registration-status');
      return response.json();
    },
    enabled: shouldLoadData, // Only execute after initial render
    staleTime: 1000 * 60 * 60, // 60 minutes - much longer cache
    gcTime: 1000 * 60 * 60 * 2, // 2 hours garbage collection time
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false, // Disable automatic refetching
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Addon definitions for pricing calculator - employees is free and always included
  const addons = [
    { key: 'employees', name: 'Empleados', price: 0, icon: Users, isLocked: true, description: 'Alta, baja, datos personales, roles y permisos. Todo centralizado.' },
    { key: 'time_tracking', name: 'Fichajes', price: 3, icon: Clock, isLocked: false, description: 'Registro horario obligatorio. Fichan en dos toques y exportas PDF.' },
    { key: 'vacation', name: 'Ausencias', price: 3, icon: Calendar, isLocked: false, description: 'Cada empleado ve sus días, solicita fechas, y tú apruebas.' },
    { key: 'schedules', name: 'Cuadrante', price: 3, icon: CalendarDays, isLocked: false, description: 'Arrastra turnos, duplica semanas. Con IA lo montas en segundos.' },
    { key: 'messages', name: 'Mensajes', price: 5, icon: MessageSquare, isLocked: false, description: 'Comunicación profesional sin mezclar con WhatsApp personal.' },
    { key: 'reminders', name: 'Recordatorios', price: 5, icon: Bell, isLocked: false, description: 'Alertas para ti o tu equipo con notificaciones push.' },
    { key: 'documents', name: 'Documentos', price: 10, icon: FileText, isLocked: false, description: 'Nóminas, contratos, certificados... todo digital con firma.' },
    { key: 'work_reports', name: 'Partes de Trabajo', price: 8, icon: Settings, isLocked: false, description: 'Documenta trabajos con fotos, ubicación y firma del cliente.' },
    { key: 'ai_assistant', name: 'OficazIA', price: 15, icon: Zap, isLocked: false, description: 'Dile "crea el horario" y lo hace en segundos. Tu asistente 24/7.' },
  ];

  // Calculate total price (employees is free, not counted)
  const addonsTotal = addons.filter(a => selectedAddons.has(a.key) && a.price > 0).reduce((sum, a) => sum + a.price, 0);
  const usersTotal = (userCounts.employees * 2) + (userCounts.managers * 4) + (userCounts.admins * 6);
  const monthlyTotal = addonsTotal + usersTotal;

  const toggleAddon = (key: string) => {
    // Employees is always included, cannot be removed
    if (key === 'employees') return;
    
    const newSet = new Set(selectedAddons);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedAddons(newSet);
  };

  // Funciones principales
  const mainFeatures = [
    {
      icon: Clock,
      title: "Control horario",
      description: "Control automático con seguimiento en tiempo real y reportes detallados"
    },
    {
      icon: Calendar,
      title: "Gestión de ausencias",
      description: "Solicitudes digitales con flujo de aprobación y calendario integrado"
    },
    {
      icon: CalendarDays,
      title: "Cuadrante",
      description: "Planificación visual drag & drop con turnos inteligentes y gestión semanal"
    }
  ];

  // Funciones adicionales
  const additionalFeatures = [
    {
      icon: FileText,
      title: "Documentos",
      description: "Subida automática con detección de empleados y categorización inteligente"
    },
    {
      icon: MessageSquare,
      title: "Mensajes",
      description: "Comunicación empresarial estilo WhatsApp para toda la organización"
    },
    {
      icon: Settings,
      title: "Recordatorios",
      description: "Recordatorios personalizados, tareas automáticas y notificaciones inteligentes"
    }
  ];

  const features = [...mainFeatures, ...additionalFeatures];

  const testimonials = [
    {
      name: "María González",
      role: "Directora de RRHH",
      company: "TechCorp",
      content: "Oficaz transformó completamente nuestra gestión de empleados. Lo que antes tomaba horas ahora se hace en minutos.",
      rating: 5
    },
    {
      name: "Carlos Ruiz",
      role: "CEO",
      company: "StartupFlow",
      content: "La facilidad de uso es increíble. Nuestros empleados se adaptaron en días, no semanas.",
      rating: 5
    },
    {
      name: "Ana Martín",
      role: "Responsable de Operaciones",
      company: "LogisticsPro",
      content: "El control de tiempo en tiempo real nos ahorró miles de euros en el primer mes.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className={`border-b fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/95 backdrop-blur-md shadow-lg shadow-black/5 border-gray-200' 
          : 'bg-white backdrop-blur-md shadow-xl shadow-black/30 border-gray-300'
      }`}
      style={{
        paddingTop: '8px',
        paddingBottom: '8px',
        marginTop: 'env(safe-area-inset-top, 0px)'
      }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-10">
            <div className="flex items-center">
              <img src={oficazLogo} alt="Oficaz" className="h-8 md:h-10 w-auto object-contain" loading="eager" style={{ minWidth: '120px' }} />
            </div>
            
            <nav className="hidden md:flex items-center justify-between flex-1 ml-8">
              <div className="flex items-center space-x-8">
                <a href="#funciones" className="text-gray-700 hover:text-gray-900 transition-colors font-medium">Funciones</a>
                <a href="#precios" className="text-gray-700 hover:text-gray-900 transition-colors font-medium">Precios</a>
              </div>
              
              <div className="flex items-center space-x-3">
                <a 
                  href="https://wa.me/34614028600" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center mr-2"
                >
                  <Button 
                    size="sm" 
                    className="bg-[#25D366] hover:bg-[#20BA5A] text-white font-semibold px-4 py-2 shadow-lg shadow-[#25D366]/25 border-0 rounded-lg hover:shadow-xl hover:shadow-[#25D366]/30 transition-all duration-300 hover:scale-105"
                  >
                    <FaWhatsapp className="w-5 h-5 mr-2" />
                    WhatsApp
                  </Button>
                </a>
                {registrationSettings?.publicRegistrationEnabled ? (
                  <Link href="/request-code">
                    <Button size="sm" className="bg-gradient-to-r from-[#007AFF] to-blue-600 hover:from-[#0056CC] hover:to-blue-700 text-white font-semibold px-6 py-2 shadow-lg shadow-[#007AFF]/25 border-0 rounded-lg hover:shadow-xl hover:shadow-[#007AFF]/30 transition-all duration-300 hover:scale-105">
                      Prueba Gratis
                    </Button>
                  </Link>
                ) : (
                  <Button 
                    size="sm" 
                    onClick={() => setIsContactFormOpen(true)}
                    className="bg-gradient-to-r from-[#007AFF] to-blue-600 hover:from-[#0056CC] hover:to-blue-700 text-white font-semibold px-6 py-2 shadow-lg shadow-[#007AFF]/25 border-0 rounded-lg hover:shadow-xl hover:shadow-[#007AFF]/30 transition-all duration-300 hover:scale-105"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Contacta
                  </Button>
                )}
                <Link href="/login">
                  <Button variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-900 font-semibold px-4 py-2 rounded-lg shadow-lg transition-all duration-300 hover:scale-105">
                    Iniciar Sesión
                  </Button>
                </Link>
              </div>
            </nav>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center space-x-2">
              {registrationSettings?.publicRegistrationEnabled ? (
                <Link href="/request-code">
                  <Button size="sm" className="bg-gradient-to-r from-[#007AFF] to-blue-600 hover:from-[#0056CC] hover:to-blue-700 text-white font-semibold px-3 shadow-lg shadow-[#007AFF]/25 border-0 rounded-lg">
                    Registrarse
                  </Button>
                </Link>
              ) : (
                <Button 
                  size="sm" 
                  onClick={() => setIsContactFormOpen(true)}
                  className="bg-gradient-to-r from-[#007AFF] to-blue-600 hover:from-[#0056CC] hover:to-blue-700 text-white font-semibold px-3 shadow-lg shadow-[#007AFF]/25 border-0 rounded-lg"
                >
                  <Mail className="w-4 h-4" />
                </Button>
              )}
              <Link href="/login">
                <Button variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-900 font-semibold px-3 py-1.5 rounded-lg shadow-lg transition-all duration-300">
                  Entrar
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Floating WhatsApp Button - Mobile Only */}
      <a 
        href="https://wa.me/34614028600" 
        target="_blank" 
        rel="noopener noreferrer"
        className="md:hidden fixed bottom-6 right-6 z-50 inline-flex items-center justify-center w-16 h-16 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-full shadow-2xl shadow-[#25D366]/40 transition-all duration-300 hover:scale-110 active:scale-95"
        aria-label="Contactar por WhatsApp"
      >
        <FaWhatsapp className="w-8 h-8" />
      </a>

      {/* Hero Section - Static, no scroll effects */}
      <section 
        className="relative min-h-screen flex items-center justify-center pt-16"
        style={{ 
          backgroundImage: `url(${heroBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-slate-900/70" />
        
        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="space-y-8 lg:space-y-10">
            {/* Main Headline - Dynamic based on difficulty */}
            <div className="space-y-3">
              <h1 
                className="text-5xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-white leading-[1.1] tracking-tight transition-all duration-500 ease-out"
                style={{
                  opacity: isLoaded ? 1 : 0,
                  transform: isLoaded ? 'translateY(0)' : 'translateY(40px)',
                }}
              >
                {difficultyMode === 'dificil' ? 'Reto aceptado.' : 'Haz lo que te mueve.'}
              </h1>
              <p 
                className={`text-3xl sm:text-3xl md:text-4xl lg:text-5xl font-bold transition-all duration-500 ease-out ${
                  difficultyMode === 'dificil' ? 'text-red-400' : 'text-[#60B5FF]'
                }`}
                style={{
                  opacity: isLoaded ? 1 : 0,
                  transform: isLoaded ? 'translateY(0)' : 'translateY(40px)',
                  transitionDelay: '150ms',
                }}
              >
                {difficultyMode === 'dificil' ? 'Una empresa en llamas nos motiva.' : 'Déjanos la parte aburrida.'}
              </p>
            </div>

            {/* Subtext */}
            <p 
              className="text-xl md:text-xl lg:text-2xl text-white/90 max-w-2xl mx-auto leading-relaxed font-medium transition-all duration-1000 ease-out"
              style={{
                opacity: isLoaded ? 1 : 0,
                transform: isLoaded ? 'translateY(0)' : 'translateY(30px)',
                transitionDelay: '300ms',
              }}
            >
              La app de gestión empresarial en un clic
            </p>

            {/* Difficulty Slider - Container always present to prevent layout shift */}
            <div className="flex flex-col items-center gap-4 pt-4 min-h-[100px]">
              <p 
                className="text-white/70 text-sm font-medium transition-all duration-1000 ease-out"
                style={{
                  opacity: isLoaded && registrationSettings?.publicRegistrationEnabled ? 1 : 0,
                  transform: isLoaded && registrationSettings?.publicRegistrationEnabled ? 'translateY(0)' : 'translateY(30px)',
                  transitionDelay: '450ms',
                }}
              >
                Elige nivel de dificultad
              </p>
              <div
                className="transition-all duration-1000 ease-out"
                style={{
                  opacity: isLoaded && registrationSettings?.publicRegistrationEnabled ? 1 : 0,
                  transform: isLoaded && registrationSettings?.publicRegistrationEnabled ? 'translateY(0)' : 'translateY(30px)',
                  transitionDelay: '600ms',
                }}
              >
                <DifficultySlider onSelect={setDifficultyMode} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Focus Section - Apple Style */}
      <section className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-100 to-gray-50 relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center py-20">
          <ScrollReveal>
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 leading-[1.1] tracking-tight mb-6">
              Concentra tu energía<br />
              <span className="bg-gradient-to-r from-[#007AFF] to-blue-600 bg-clip-text text-transparent">donde importa.</span>
            </h2>
          </ScrollReveal>
          
          <ScrollReveal delay={0.15}>
            <p className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-600 mb-10 leading-tight">
              Haz crecer tu empresa.<br className="hidden sm:block" /> Lo rutinario queda fuera de tu mesa.
            </p>
          </ScrollReveal>
          
          <ScrollReveal delay={0.3}>
            <p className="text-lg md:text-xl text-gray-500 max-w-3xl mx-auto leading-relaxed">
              Dirigir una empresa exige foco real, no perder horas en tareas que drenan atención y no aportan valor. Tú impulsa, decide y construye. Todo lo repetitivo, lo tedioso y lo administrativo queda en manos de Oficaz.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Features Section - Two Columns with Mobile Preview */}
      <section id="funciones" className="min-h-screen bg-white relative overflow-hidden py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-6 h-full">
          {/* Header */}
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 tracking-tight">
              Funciones modulares
            </h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto">
              Activa solo lo que necesitas. Sin paquetes, sin compromisos.
            </p>
          </ScrollReveal>

          {/* Mobile: Swipeable Carousel with Description Below */}
          <div className="lg:hidden">
            <div className="-mx-6 py-8">
              <Carousel 
                className="w-full" 
                opts={{ align: 'center', loop: true }}
                setApi={(api) => {
                  if (api) {
                    api.on('select', () => {
                      const index = api.selectedScrollSnap();
                      setPreviewAddon(addons[index]?.key || 'time_tracking');
                    });
                  }
                }}
              >
                <CarouselContent className="-ml-2">
                  {addons.map((addon, index) => (
                    <CarouselItem key={addon.key} className="pl-2 basis-[80%] sm:basis-[65%]">
                      <div className="flex flex-col items-center py-2">
                        {/* Phone Preview - Taller for mobile, no shadow */}
                        <div className="relative bg-gray-900 rounded-[2.5rem] p-2">
                          <div className="relative bg-[#0a1628] rounded-[2rem] overflow-hidden" style={{ width: '200px', aspectRatio: '9/19.5' }}>
                            <div className="absolute top-0 left-0 right-0 h-7 bg-[#0a1628] z-10 flex items-center justify-between px-3 pt-1">
                              <span className="text-[10px] font-semibold text-white">17:00</span>
                              <div className="w-3 h-1.5 bg-white rounded-sm"></div>
                            </div>
                            <div className="pt-7 h-full overflow-hidden">
                              <MobilePreviewContent addonKey={addon.key} />
                            </div>
                          </div>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-1 bg-white/30 rounded-full"></div>
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
            </div>
            
            {/* Description below carousel */}
            <div className="-mt-2 px-4">
              {addons.map((addon) => {
                if (addon.key !== previewAddon) return null;
                const IconComponent = addon.icon;
                return (
                  <div key={addon.key} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        addon.isLocked 
                          ? 'bg-gradient-to-br from-green-500 to-green-600' 
                          : 'bg-gradient-to-br from-[#007AFF] to-blue-600'
                      }`}>
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900">{addon.name}</h3>
                          {addon.isLocked && (
                            <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded font-medium">Gratis</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 leading-relaxed">{addon.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Dots indicator */}
            <div className="flex justify-center gap-1.5 mt-4">
              {addons.map((addon, i) => (
                <button
                  key={addon.key}
                  onClick={() => setPreviewAddon(addon.key)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    previewAddon === addon.key ? 'bg-[#007AFF] w-4' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Desktop: Two Column Carousel Layout - Apple Style */}
          <div className="hidden lg:block">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center max-w-5xl mx-auto">
              {/* Left: Feature Card with Extended Description */}
              <div className="relative">
                <AnimatePresence mode="wait">
                  {addons.map((addon) => {
                    if (addon.key !== previewAddon) return null;
                    const IconComponent = addon.icon;
                    const currentIndex = addons.findIndex(a => a.key === previewAddon);
                    
                    return (
                      <motion.div
                        key={addon.key}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                        className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100"
                      >
                        {/* Feature Header */}
                        <div className="flex items-start gap-5 mb-6">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                            addon.isLocked 
                              ? 'bg-gradient-to-br from-green-500 to-green-600' 
                              : 'bg-gradient-to-br from-[#007AFF] to-blue-600'
                          }`}>
                            <IconComponent className="w-8 h-8 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-2xl font-bold text-gray-900">{addon.name}</h3>
                              {addon.isLocked && (
                                <span className="text-xs bg-green-500 text-white px-2.5 py-1 rounded-full font-semibold">Incluido</span>
                              )}
                            </div>
                            <p className="text-gray-500 text-base leading-relaxed">{addon.description}</p>
                          </div>
                        </div>
                        
                        {/* Extended Description */}
                        <div className="bg-gray-50 rounded-2xl p-5 mb-6">
                          <p className="text-gray-600 text-sm leading-relaxed">
                            {addonExtendedDescriptions[addon.key]}
                          </p>
                        </div>
                        
                        {/* Navigation - Apple Style */}
                        <div className="flex items-center justify-between">
                          {/* Arrow Navigation */}
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                const prevIndex = currentIndex === 0 ? addons.length - 1 : currentIndex - 1;
                                setPreviewAddon(addons[prevIndex].key);
                              }}
                              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all duration-200 hover:scale-105"
                              aria-label="Anterior"
                            >
                              <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <button
                              onClick={() => {
                                const nextIndex = currentIndex === addons.length - 1 ? 0 : currentIndex + 1;
                                setPreviewAddon(addons[nextIndex].key);
                              }}
                              className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all duration-200 hover:scale-105"
                              aria-label="Siguiente"
                            >
                              <ChevronRight className="w-5 h-5 text-gray-600" />
                            </button>
                          </div>
                          
                          {/* Pagination Dots */}
                          <div className="flex items-center gap-2">
                            {addons.map((a, i) => (
                              <button
                                key={a.key}
                                onClick={() => setPreviewAddon(a.key)}
                                className={`transition-all duration-300 rounded-full ${
                                  a.key === previewAddon 
                                    ? 'w-6 h-2 bg-[#007AFF]' 
                                    : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                                }`}
                                aria-label={`Ver ${a.name}`}
                              />
                            ))}
                          </div>
                          
                          {/* Page Counter */}
                          <span className="text-sm text-gray-400 font-medium">
                            {currentIndex + 1} / {addons.length}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Right: Mobile Preview Mockup */}
              <div className="flex justify-center">
              <div className="relative">
                {/* Phone Frame - Narrower iPhone style with enhanced shadow */}
                <div className="relative bg-gray-900 rounded-[2.5rem] p-2 shadow-[0_25px_80px_-12px_rgba(0,0,0,0.4),0_12px_40px_-8px_rgba(0,0,0,0.3)]">
                  {/* Screen - Dark theme like real app */}
                  <div className="relative bg-[#0a1628] rounded-[2rem] overflow-hidden" style={{ width: '200px', aspectRatio: '9/19' }}>
                    {/* Status Bar */}
                    <div className="absolute top-0 left-0 right-0 h-8 bg-[#0a1628] z-10 flex items-center justify-between px-4 pt-1">
                      <span className="text-[10px] font-semibold text-white">17:00</span>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-1.5 bg-white rounded-sm"></div>
                      </div>
                    </div>
                    
                    {/* Dynamic Content based on selected addon */}
                    <div className="pt-8 h-full overflow-hidden">
                      <AnimatePresence mode="wait">
                      {previewAddon === 'time_tracking' && (
                        <motion.div
                          key="time_tracking"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                          className="h-full"
                        >
                        <div className="p-3 h-full bg-[#0a1628]">
                          {/* Header */}
                          <h3 className="text-white font-bold text-sm mb-0.5">Control de Tiempo</h3>
                          <p className="text-gray-400 text-[8px] mb-3">Revisa tu historial de fichajes</p>
                          
                          {/* Month nav */}
                          <div className="flex items-center justify-center gap-3 mb-3">
                            <ChevronLeft className="w-3 h-3 text-gray-400" />
                            <span className="text-white text-[10px] font-medium">octubre 2025</span>
                            <ChevronRight className="w-3 h-3 text-gray-400" />
                          </div>
                          
                          {/* Total del mes */}
                          <div className="bg-[#1a2942] rounded-xl p-3 mb-3">
                            <p className="text-gray-400 text-[8px] text-center mb-1">Total del mes</p>
                            <p className="text-white font-bold text-lg text-center">160h 45m</p>
                            
                            {/* Mini month charts */}
                            <div className="flex justify-between mt-3 gap-1">
                              {[
                                { month: 'jul', hours: '162h', active: false },
                                { month: 'ago', hours: '158h', active: false },
                                { month: 'sep', hours: '165h', active: false },
                                { month: 'oct', hours: '160h', active: true },
                              ].map((m, i) => (
                                <div key={i} className={`flex-1 rounded-lg p-1.5 ${m.active ? 'bg-[#007AFF]/30 border border-[#007AFF]' : 'bg-[#0a1628]'}`}>
                                  <div className="h-6 bg-[#007AFF] rounded-t-sm mb-1"></div>
                                  <p className="text-gray-400 text-[7px] text-center">{m.month}</p>
                                  <p className="text-white text-[7px] text-center font-medium">{m.hours}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Week section */}
                          <div className="bg-[#1a2942] rounded-xl p-2">
                            <div className="flex justify-between items-center mb-2">
                              <p className="text-white text-[8px]">octubre semana del 27-02</p>
                              <span className="bg-[#007AFF]/20 text-[#007AFF] text-[7px] font-medium px-1.5 py-0.5 rounded">40h 12m</span>
                            </div>
                            {/* Day entries with break indicators */}
                            <div className="space-y-1.5">
                              {[
                                { day: 'viernes', num: '31', hours: '8h 28m', breakPos: 60 },
                                { day: 'jueves', num: '30', hours: '8h 29m', breakPos: 55 },
                              ].map((entry, i) => (
                                <div key={i} className="bg-[#0a1628] rounded-md p-1.5">
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-white text-[7px] font-medium">{entry.day} {entry.num}</span>
                                    <span className="text-gray-400 text-[7px]">{entry.hours}</span>
                                  </div>
                                  {/* Progress bar with orange break indicator inside */}
                                  <div className="relative h-2.5 bg-[#007AFF] rounded-full">
                                    <div className="absolute top-1/2 w-1.5 h-1.5 bg-orange-400 rounded-full" style={{ left: `${entry.breakPos}%`, transform: 'translate(-50%, -50%)' }}></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        </motion.div>
                      )}
                      
                      {previewAddon === 'vacation' && (
                        <motion.div
                          key="vacation"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                          className="h-full"
                        >
                        <div className="p-3 h-full bg-[#0a1628]">
                          <h3 className="text-white font-bold text-sm mb-0.5">Ausencias</h3>
                          <p className="text-gray-400 text-[8px] mb-2">Solicita y consulta el estado</p>
                          
                          {/* Stats row */}
                          <div className="bg-[#1a2942] rounded-xl p-2 mb-2">
                            <div className="grid grid-cols-3 gap-1 text-center mb-2">
                              <div>
                                <p className="text-[#007AFF] font-bold text-sm">30</p>
                                <p className="text-gray-300 text-[6px]">TOTAL</p>
                              </div>
                              <div>
                                <p className="text-green-400 font-bold text-sm">26</p>
                                <p className="text-gray-300 text-[6px]">APROBADOS</p>
                              </div>
                              <div>
                                <p className="text-[#007AFF] font-bold text-sm">4</p>
                                <p className="text-gray-300 text-[6px]">DISPONIBLES</p>
                              </div>
                            </div>
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-gray-400 text-[7px]">Progreso anual</p>
                              <p className="text-gray-400 text-[7px]">86.7%</p>
                            </div>
                            <div className="w-full bg-[#0a1628] rounded-full h-2">
                              <div className="bg-[#007AFF] h-2 rounded-full" style={{ width: '87%' }}></div>
                            </div>
                          </div>
                          
                          {/* Solicitar button */}
                          <button className="w-full bg-[#007AFF] rounded-lg p-1.5 mb-2 flex items-center justify-center gap-1">
                            <Calendar className="w-3 h-3 text-white" />
                            <span className="text-white text-[7px] font-medium">Solicitar Ausencia</span>
                          </button>
                          
                          {/* Request cards - Apple style */}
                          <div className="space-y-1.5">
                            {[
                              { type: 'Vacaciones', period: '10 dic → 12 dic', days: '3', status: 'approved', icon: 'vacation', iconColor: 'bg-green-500/20', iconTextColor: 'text-green-400' },
                              { type: 'Permiso paternidad', period: '1 nov → 15 nov', days: '15', status: 'approved', icon: 'baby', iconColor: 'bg-pink-500/20', iconTextColor: 'text-pink-400' },
                              { type: 'Baja médica', period: '5 de noviembre', days: '1', status: 'pending', icon: 'medical', iconColor: 'bg-red-500/20', iconTextColor: 'text-red-400' },
                              { type: 'Asuntos propios', period: '20 de octubre', days: '1', status: 'approved', icon: 'briefcase', iconColor: 'bg-blue-500/20', iconTextColor: 'text-blue-400' },
                              { type: 'Formación', period: '15 sep → 17 sep', days: '3', status: 'rejected', icon: 'graduation', iconColor: 'bg-purple-500/20', iconTextColor: 'text-purple-400' },
                            ].map((req, i) => {
                              const IconComponent = req.icon === 'vacation' ? Plane : 
                                                    req.icon === 'medical' ? Stethoscope :
                                                    req.icon === 'baby' ? Baby :
                                                    req.icon === 'graduation' ? GraduationCap :
                                                    Briefcase;
                              return (
                                <div key={i} className="bg-white/5 rounded-lg overflow-hidden border border-white/10 flex">
                                  <div className="flex-1 p-1.5 flex items-center gap-1.5">
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center ${req.iconColor}`}>
                                      <IconComponent className={`w-2.5 h-2.5 ${req.iconTextColor}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white text-[7px] font-medium">{req.type}</p>
                                      <p className="text-gray-400 text-[5px]">{req.period} • {req.days} día{Number(req.days) > 1 ? 's' : ''}</p>
                                    </div>
                                  </div>
                                  <div className={`w-8 flex flex-col items-center justify-center ${
                                    req.status === 'approved' ? 'bg-green-500/10' : 
                                    req.status === 'rejected' ? 'bg-red-500/10' : 
                                    'bg-amber-500/10'
                                  }`}>
                                    {req.status === 'approved' && <CheckCircle className="w-2.5 h-2.5 text-green-400" />}
                                    {req.status === 'rejected' && <XCircle className="w-2.5 h-2.5 text-red-400" />}
                                    {req.status === 'pending' && <Clock className="w-2.5 h-2.5 text-amber-400" />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        </motion.div>
                      )}
                      
                      {previewAddon === 'employees' && (
                        <motion.div
                          key="employees"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                          className="h-full"
                        >
                        <div className="p-3 h-full bg-[#0a1628]">
                          <h3 className="text-white font-bold text-sm mb-0.5">Mi Equipo</h3>
                          <p className="text-gray-400 text-[8px] mb-2">Gestiona tu plantilla</p>
                          
                          {/* 3 role count cards with distinct colors */}
                          <div className="grid grid-cols-3 gap-1.5 mb-2">
                            <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-2 text-center">
                              <p className="text-purple-400 font-bold text-sm">1</p>
                              <p className="text-purple-300/70 text-[6px]">Admin</p>
                            </div>
                            <div className="bg-[#007AFF]/20 border border-[#007AFF]/30 rounded-lg p-2 text-center">
                              <p className="text-[#007AFF] font-bold text-sm">1</p>
                              <p className="text-blue-300/70 text-[6px]">Manager</p>
                            </div>
                            <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-2 text-center">
                              <p className="text-green-400 font-bold text-sm">10</p>
                              <p className="text-green-300/70 text-[6px]">Empleados</p>
                            </div>
                          </div>
                          
                          {/* Add user button */}
                          <button className="w-full bg-[#007AFF] rounded-lg p-2 mb-2 flex items-center justify-center gap-1.5">
                            <Users className="w-3 h-3 text-white" />
                            <span className="text-white text-[8px] font-semibold">Crear usuario</span>
                          </button>
                          
                          {/* Employee cards */}
                          <div className="space-y-1">
                            {[
                              { name: 'María García', role: 'Admin', avatar: avatarWoman01, roleColor: 'text-purple-400', swipeDir: null },
                              { name: 'Carlos López', role: 'Manager', avatar: avatarMan01, roleColor: 'text-[#007AFF]', swipeDir: 'right' },
                              { name: 'Ana Martín', role: 'Empleado', avatar: avatarWoman02, roleColor: 'text-green-400', swipeDir: 'left' },
                              { name: 'Pedro Ruiz', role: 'Empleado', avatar: avatarMan02, roleColor: 'text-green-400', swipeDir: null },
                              { name: 'Laura Sanz', role: 'Empleado', avatar: avatarWoman03, roleColor: 'text-green-400', swipeDir: null },
                            ].map((emp, i) => (
                              <div key={i} className="relative overflow-hidden rounded-lg">
                                {/* Swipe left action background (call - green) - shown on right side */}
                                {emp.swipeDir === 'left' && (
                                  <div className="absolute inset-0 bg-green-500 flex items-center justify-end pr-2">
                                    <Phone className="w-3 h-3 text-white" />
                                  </div>
                                )}
                                {/* Swipe right action background (message - blue) - shown on left side */}
                                {emp.swipeDir === 'right' && (
                                  <div className="absolute inset-0 bg-[#007AFF] flex items-center justify-start pl-2">
                                    <MessageSquare className="w-3 h-3 text-white" />
                                  </div>
                                )}
                                {/* Card content */}
                                <div 
                                  className={`bg-[#1a2942] p-1.5 flex items-center gap-2 relative transition-transform ${
                                    emp.swipeDir === 'left' ? 'translate-x-[-20px] rounded-r-lg' : ''
                                  } ${
                                    emp.swipeDir === 'right' ? 'translate-x-[20px] rounded-l-lg' : ''
                                  }`}
                                >
                                  <img 
                                    src={emp.avatar} 
                                    alt={emp.name}
                                    className="w-6 h-6 rounded-full object-cover"
                                  />
                                  <div className="flex-1">
                                    <p className="text-white text-[7px] font-medium">{emp.name}</p>
                                    <p className={`text-[6px] ${emp.roleColor}`}>{emp.role}</p>
                                  </div>
                                  <Settings className="w-2.5 h-2.5 text-gray-500" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        </motion.div>
                      )}
                      
                      {previewAddon === 'schedules' && (
                        <motion.div
                          key="schedules"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                          className="h-full"
                        >
                        <div className="p-3 h-full bg-[#0a1628]">
                          <h3 className="text-white font-bold text-sm mb-0.5">Cuadrante</h3>
                          <p className="text-gray-400 text-[8px] mb-2">Consulta tus turnos asignados</p>
                          
                          {/* Week navigation */}
                          <div className="bg-[#1a2942] rounded-lg p-1.5 mb-2 flex items-center justify-between">
                            <span className="text-gray-500 text-[8px]">{'<'}</span>
                            <span className="text-white text-[8px] font-medium">Semana 29 - 5 oct</span>
                            <span className="text-gray-500 text-[8px]">{'>'}</span>
                          </div>
                          
                          {/* Day with shifts - each with location */}
                          <div className="bg-[#1a2942] rounded-xl p-2 mb-2">
                            <div className="flex justify-between items-center mb-1.5">
                              <p className="text-white text-[8px] font-semibold">Lunes <span className="text-gray-400 font-normal">29 sep</span></p>
                              <p className="text-gray-500 text-[7px]">2 turnos</p>
                            </div>
                            <div className="space-y-1.5">
                              <div className="bg-red-500 rounded-md px-2 py-1.5">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-white text-[7px] font-medium">Mañana</span>
                                  <span className="text-white/80 text-[6px]">09:00-14:00</span>
                                </div>
                                <div className="flex items-center gap-1 text-white/90">
                                  <MapPin className="w-2.5 h-2.5" />
                                  <span className="text-[6px]">Oficina Central →</span>
                                </div>
                              </div>
                              <div className="bg-green-500 rounded-md px-2 py-1.5">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-white text-[7px] font-medium">Tarde</span>
                                  <span className="text-white/80 text-[6px]">15:00-20:00</span>
                                </div>
                                <div className="flex items-center gap-1 text-white/90">
                                  <MapPin className="w-2.5 h-2.5" />
                                  <span className="text-[6px]">Cliente ABC S.L. →</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Second day */}
                          <div className="bg-[#1a2942] rounded-xl p-2 mb-2">
                            <div className="flex justify-between items-center mb-1.5">
                              <p className="text-white text-[8px] font-semibold">Martes <span className="text-gray-400 font-normal">30 sep</span></p>
                              <p className="text-gray-500 text-[7px]">1 turno</p>
                            </div>
                            <div className="bg-[#007AFF] rounded-md px-2 py-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-white text-[7px] font-medium">Completo</span>
                                <span className="text-white/80 text-[6px]">08:00-17:00</span>
                              </div>
                              <div className="flex items-center gap-1 text-white/90">
                                <MapPin className="w-2.5 h-2.5" />
                                <span className="text-[6px]">Almacén Norte →</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Third day */}
                          <div className="bg-[#1a2942] rounded-xl p-2 mb-2">
                            <div className="flex justify-between items-center mb-1.5">
                              <p className="text-white text-[8px] font-semibold">Miércoles <span className="text-gray-400 font-normal">1 oct</span></p>
                              <p className="text-gray-500 text-[7px]">1 turno</p>
                            </div>
                            <div className="bg-purple-500 rounded-md px-2 py-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-white text-[7px] font-medium">Noche</span>
                                <span className="text-white/80 text-[6px]">22:00-06:00</span>
                              </div>
                              <div className="flex items-center gap-1 text-white/90">
                                <MapPin className="w-2.5 h-2.5" />
                                <span className="text-[6px]">Fábrica Sur →</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Fourth day */}
                          <div className="bg-[#1a2942] rounded-xl p-2">
                            <div className="flex justify-between items-center mb-1.5">
                              <p className="text-white text-[8px] font-semibold">Jueves <span className="text-gray-400 font-normal">2 oct</span></p>
                              <p className="text-gray-500 text-[7px]">1 turno</p>
                            </div>
                            <div className="bg-orange-500 rounded-md px-2 py-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-white text-[7px] font-medium">Mañana</span>
                                <span className="text-white/80 text-[6px]">07:00-15:00</span>
                              </div>
                              <div className="flex items-center gap-1 text-white/90">
                                <MapPin className="w-2.5 h-2.5" />
                                <span className="text-[6px]">Sede Principal →</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        </motion.div>
                      )}
                      
                      {previewAddon === 'messages' && (
                        <motion.div
                          key="messages"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                          className="h-full"
                        >
                        <div className="p-3 h-full bg-[#0a1628]">
                          <h3 className="text-white font-bold text-sm mb-0.5">Mensajes</h3>
                          <p className="text-gray-400 text-[8px] mb-3">Conversaciones</p>
                          
                          <div className="bg-[#1a2942] rounded-xl overflow-hidden">
                            {[
                              { name: 'Equipo', msg: 'Reunión mañana', time: '10:30', unread: 3 },
                              { name: 'Carlos', msg: 'Terminé el informe', time: '09:15', unread: 0 },
                              { name: 'RRHH', msg: 'Recordatorio', time: 'Ayer', unread: 1 },
                            ].map((chat, i) => (
                              <div key={i} className="p-2 flex items-center gap-2 border-b border-[#0a1628] last:border-0">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#007AFF] to-blue-600 flex items-center justify-center text-white text-[7px] font-bold">
                                  {chat.name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-center">
                                    <p className="text-white text-[8px] font-medium truncate">{chat.name}</p>
                                    <span className="text-gray-500 text-[7px]">{chat.time}</span>
                                  </div>
                                  <p className="text-gray-400 text-[7px] truncate">{chat.msg}</p>
                                </div>
                                {chat.unread > 0 && (
                                  <span className="w-4 h-4 bg-[#007AFF] rounded-full text-white text-[7px] flex items-center justify-center">{chat.unread}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        </motion.div>
                      )}
                      
                      {previewAddon === 'reminders' && (
                        <motion.div
                          key="reminders"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                          className="h-full"
                        >
                        <div className="p-3 h-full bg-[#0a1628]">
                          <h3 className="text-white font-bold text-sm mb-0.5">Recordatorios</h3>
                          <p className="text-gray-400 text-[8px] mb-2">Gestiona tus recordatorios</p>
                          
                          {/* Search and filter row */}
                          <div className="flex gap-1.5 mb-2">
                            <div className="flex-1 bg-[#1a2942] rounded-lg px-2 py-1.5">
                              <p className="text-gray-500 text-[6px]">Buscar...</p>
                            </div>
                            <div className="bg-[#1a2942] rounded-lg px-2 py-1.5 flex items-center gap-1">
                              <p className="text-gray-300 text-[6px]">Activos</p>
                            </div>
                            <div className="bg-[#007AFF] rounded-lg px-2 py-1.5">
                              <p className="text-white text-[6px]">+ Nuevo</p>
                            </div>
                          </div>
                          
                          {/* Reminder cards */}
                          <div className="space-y-1.5">
                            {/* Card 1 - Alta prioridad (rosa suave) - compartido */}
                            <div className="bg-pink-50 rounded-xl p-2 shadow-sm">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-pink-500 text-[6px] font-medium">Alta</span>
                                <div className="flex items-center gap-1">
                                  <Bell className="w-2 h-2 text-gray-400" />
                                  <Users className="w-2 h-2 text-gray-400" />
                                  <Edit className="w-2 h-2 text-gray-400" />
                                  <Trash2 className="w-2 h-2 text-gray-400" />
                                </div>
                              </div>
                              <p className="text-gray-900 text-[7px] font-semibold">Renovar contrato proveedor</p>
                              <p className="text-gray-600 text-[5px] mt-0.5">Revisar condiciones y firmar antes del día 15</p>
                              <div className="flex items-center gap-1 mt-1 text-pink-400">
                                <Calendar className="w-2 h-2" />
                                <span className="text-[5px]">Mañana</span>
                              </div>
                              <div className="flex items-center justify-between mt-1.5">
                                <div className="flex -space-x-1">
                                  <img src={avatarWoman01} alt="" className="w-4 h-4 rounded-full border-2 border-pink-50 object-cover" />
                                  <img src={avatarMan01} alt="" className="w-4 h-4 rounded-full border-2 border-pink-50 object-cover" />
                                </div>
                                <button className="flex items-center gap-0.5 text-gray-500 text-[5px]">
                                  <div className="w-2.5 h-2.5 rounded-full border border-gray-400"></div>
                                  Completar
                                </button>
                              </div>
                            </div>
                            
                            {/* Card 2 - Media prioridad (amarillo suave) - sin compartir */}
                            <div className="bg-yellow-50 rounded-xl p-2 shadow-sm">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-yellow-600 text-[6px] font-medium">Media</span>
                                <div className="flex items-center gap-1">
                                  <Bell className="w-2 h-2 text-gray-400" />
                                  <Users className="w-2 h-2 text-gray-400" />
                                  <Edit className="w-2 h-2 text-gray-400" />
                                  <Trash2 className="w-2 h-2 text-gray-400" />
                                </div>
                              </div>
                              <p className="text-gray-900 text-[7px] font-semibold">Enviar nóminas noviembre</p>
                              <div className="flex items-center gap-1 mt-1 text-yellow-500">
                                <Calendar className="w-2 h-2" />
                                <span className="text-[5px]">Hace 2 días</span>
                              </div>
                              <div className="flex items-center justify-end mt-1.5">
                                <button className="flex items-center gap-0.5 text-gray-500 text-[5px]">
                                  <div className="w-2.5 h-2.5 rounded-full border border-gray-400"></div>
                                  Completar
                                </button>
                              </div>
                            </div>
                            
                            {/* Card 3 - Baja prioridad (verde suave) - compartido con 1 persona */}
                            <div className="bg-green-50 rounded-xl p-2 shadow-sm">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-green-600 text-[6px] font-medium">Baja</span>
                                <div className="flex items-center gap-1">
                                  <Bell className="w-2 h-2 text-gray-400" />
                                  <Users className="w-2 h-2 text-gray-400" />
                                  <Edit className="w-2 h-2 text-gray-400" />
                                  <Trash2 className="w-2 h-2 text-gray-400" />
                                </div>
                              </div>
                              <p className="text-gray-900 text-[7px] font-semibold">Revisión equipos oficina</p>
                              <div className="flex items-center gap-1 mt-1 text-green-500">
                                <Calendar className="w-2 h-2" />
                                <span className="text-[5px]">Próxima semana</span>
                              </div>
                              <div className="flex items-center justify-between mt-1.5">
                                <div className="flex -space-x-1">
                                  <img src={avatarMan02} alt="" className="w-4 h-4 rounded-full border-2 border-green-50 object-cover" />
                                </div>
                                <button className="flex items-center gap-0.5 text-gray-500 text-[5px]">
                                  <div className="w-2.5 h-2.5 rounded-full border border-gray-400"></div>
                                  Completar
                                </button>
                              </div>
                            </div>
                            
                            {/* Card 4 - Media prioridad (amarillo suave) - sin compartir */}
                            <div className="bg-yellow-50 rounded-xl p-2 shadow-sm">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-yellow-600 text-[6px] font-medium">Media</span>
                                <div className="flex items-center gap-1">
                                  <Bell className="w-2 h-2 text-gray-400" />
                                  <Users className="w-2 h-2 text-gray-400" />
                                  <Edit className="w-2 h-2 text-gray-400" />
                                  <Trash2 className="w-2 h-2 text-gray-400" />
                                </div>
                              </div>
                              <p className="text-gray-900 text-[7px] font-semibold">Llamar gestoría fiscal</p>
                              <div className="flex items-center gap-1 mt-1 text-yellow-500">
                                <Calendar className="w-2 h-2" />
                                <span className="text-[5px]">Viernes</span>
                              </div>
                              <div className="flex items-center justify-end mt-1.5">
                                <button className="flex items-center gap-0.5 text-gray-500 text-[5px]">
                                  <div className="w-2.5 h-2.5 rounded-full border border-gray-400"></div>
                                  Completar
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        </motion.div>
                      )}
                      
                      {previewAddon === 'documents' && (
                        <motion.div
                          key="documents"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                          className="h-full"
                        >
                        <div className="p-3 h-full bg-[#0a1628]">
                          <h3 className="text-white font-bold text-sm mb-0.5">Documentos</h3>
                          <p className="text-gray-400 text-[8px] mb-2">Gestiona tus documentos laborales</p>
                          
                          {/* Category tabs - 2 rows */}
                          <div className="flex gap-1 mb-1">
                            <div className="flex-1 bg-[#007AFF] rounded-lg py-1 px-1 flex items-center justify-center gap-0.5">
                              <FileText className="w-2 h-2 text-white" />
                              <span className="text-white text-[5px] font-medium">Todos</span>
                            </div>
                            <div className="flex-1 bg-[#1a2942] rounded-lg py-1 px-1 flex items-center justify-center gap-0.5">
                              <CreditCard className="w-2 h-2 text-gray-400" />
                              <span className="text-gray-400 text-[5px]">Nóminas</span>
                            </div>
                          </div>
                          <div className="flex gap-1 mb-2">
                            <div className="flex-1 bg-[#1a2942] rounded-lg py-1 px-1 flex items-center justify-center gap-0.5">
                              <FileText className="w-2 h-2 text-gray-400" />
                              <span className="text-gray-400 text-[5px]">Contratos</span>
                            </div>
                            <div className="flex-1 bg-[#1a2942] rounded-lg py-1 px-1 flex items-center justify-center gap-0.5">
                              <FileText className="w-2 h-2 text-gray-400" />
                              <span className="text-gray-400 text-[5px]">Otros...</span>
                            </div>
                          </div>
                          
                          {/* Search bar */}
                          <div className="flex items-center gap-2 bg-[#1a2942] rounded-lg px-2 py-1 mb-2">
                            <Search className="w-2.5 h-2.5 text-gray-500" />
                            <span className="text-gray-500 text-[5px] flex-1">Buscar documentos...</span>
                            <span className="text-gray-400 text-[5px]">6 docs</span>
                          </div>
                          
                          <div className="bg-[#1a2942] rounded-xl overflow-hidden">
                            {[
                              { name: 'Nómina Noviembre 2025', type: 'Nómina', signed: false, size: '120 KB', date: '24 nov' },
                              { name: 'Nómina Octubre 2025', type: 'Nómina', signed: true, size: '118 KB', date: '25 oct' },
                              { name: 'Nómina Septiembre 2025', type: 'Nómina', signed: true, size: '115 KB', date: '26 sep' },
                              { name: 'Nómina Agosto 2025', type: 'Nómina', signed: true, size: '122 KB', date: '25 ago' },
                              { name: 'Contrato trabajo', type: 'Documento', signed: true, size: '1.2 MB', date: '15 ene' },
                            ].map((doc, i) => (
                              <div key={i} className="p-2 flex items-center gap-2 border-b border-[#0a1628] last:border-0">
                                <div className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-3 h-3 text-orange-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-[7px] font-medium truncate">{doc.name}</p>
                                  <div className="flex items-center gap-1">
                                    <span className="text-orange-400 text-[6px]">{doc.type}</span>
                                    <span className={`text-[6px] ${doc.signed ? 'text-green-400' : 'text-yellow-400'}`}>
                                      {doc.signed ? '✓ Firmada' : ''}
                                    </span>
                                  </div>
                                  <p className="text-gray-500 text-[5px]">{doc.size} · {doc.date}</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Eye className="w-2.5 h-2.5 text-gray-500" />
                                  {!doc.signed ? (
                                    <PenLine className="w-2.5 h-2.5 text-[#007AFF]" />
                                  ) : (
                                    <ArrowRight className="w-2.5 h-2.5 text-gray-500 rotate-90" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        </motion.div>
                      )}
                      
                      {previewAddon === 'work_reports' && (
                        <motion.div
                          key="work_reports"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                          className="h-full"
                        >
                        <div className="p-3 h-full bg-[#0a1628]">
                          <h3 className="text-white font-bold text-sm mb-0.5">Partes de Trabajo</h3>
                          <p className="text-gray-400 text-[8px] mb-3">Documenta tus servicios</p>
                          
                          <div className="bg-[#1a2942] rounded-xl p-2 mb-3 space-y-2">
                            <div className="p-1.5 bg-[#0a1628] rounded-lg">
                              <p className="text-gray-500 text-[7px]">Cliente</p>
                              <p className="text-white text-[8px]">Empresa ABC S.L.</p>
                            </div>
                            <div className="p-1.5 bg-[#0a1628] rounded-lg">
                              <p className="text-gray-500 text-[7px]">Ubicación</p>
                              <p className="text-white text-[8px]">📍 Calle Mayor, 15</p>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                              {['📸', '📸', '+'].map((icon, i) => (
                                <div key={i} className="aspect-square bg-[#0a1628] rounded-lg flex items-center justify-center text-gray-500 text-xs">
                                  {icon}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <button className="w-full bg-green-500 rounded-xl p-2 text-center">
                            <p className="text-white font-semibold text-[8px]">✍️ Firmar y enviar</p>
                          </button>
                        </div>
                        </motion.div>
                      )}
                      
                      {previewAddon === 'ai_assistant' && (
                        <motion.div
                          key="ai_assistant"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                          className="h-full"
                        >
                        <div className="p-3 h-full bg-[#0a1628] flex flex-col">
                          <h3 className="text-white font-bold text-sm mb-0.5">OficazIA</h3>
                          <p className="text-gray-400 text-[8px] mb-2">Tu asistente inteligente</p>
                          
                          <div className="flex-1 space-y-2 overflow-y-auto">
                            {/* Usuario mensaje 1 */}
                            <div className="flex justify-end">
                              <div className="bg-[#007AFF] rounded-xl rounded-tr-sm p-2 max-w-[88%]">
                                <p className="text-white text-[8px] leading-relaxed">Ramírez tiene que trabajar la semana que viene de 9 a 14 y Marta hace los turnos de tarde</p>
                              </div>
                            </div>
                            {/* IA respuesta 1 */}
                            <div className="flex gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                                <Zap className="w-2.5 h-2.5 text-white" />
                              </div>
                              <div className="bg-[#1a2942] rounded-xl rounded-tl-sm p-2 max-w-[85%]">
                                <p className="text-white text-[8px] leading-relaxed">¿El turno de Marta de 15 a 20? Recuerda que el viernes Marta está ausente, podría cubrirlo Marcos 🤔</p>
                              </div>
                            </div>
                            {/* Usuario mensaje 2 */}
                            <div className="flex justify-end">
                              <div className="bg-[#007AFF] rounded-xl rounded-tr-sm p-2 max-w-[88%]">
                                <p className="text-white text-[8px]">¡Exacto!</p>
                              </div>
                            </div>
                            {/* IA respuesta 2 */}
                            <div className="flex gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                                <Zap className="w-2.5 h-2.5 text-white" />
                              </div>
                              <div className="bg-[#1a2942] rounded-xl rounded-tl-sm p-2 max-w-[85%]">
                                <p className="text-white text-[8px]">✅ Turnos creados:</p>
                                <p className="text-gray-400 text-[7px] mt-0.5">• Ramírez: L-V 9:00-14:00</p>
                                <p className="text-gray-400 text-[7px]">• Marta: L-J 15:00-20:00</p>
                                <p className="text-gray-400 text-[7px]">• Marcos: V 15:00-20:00</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-2 flex gap-1.5">
                            <input 
                              type="text" 
                              placeholder="Escribe..."
                              className="flex-1 bg-[#1a2942] rounded-full px-3 py-1.5 text-[7px] text-white border border-[#2a3952] placeholder-gray-500"
                              readOnly
                            />
                            <button className="w-6 h-6 bg-[#007AFF] rounded-full flex items-center justify-center">
                              <ArrowRight className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        </div>
                        </motion.div>
                      )}
                      </AnimatePresence>
                    </div>
                  </div>
                  
                  {/* Home Indicator */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-white/30 rounded-full"></div>
                </div>
                
                {/* Decorative elements */}
                <div className="absolute -z-10 top-1/4 -right-8 w-32 h-32 bg-[#007AFF]/10 rounded-full blur-2xl"></div>
                <div className="absolute -z-10 bottom-1/4 -left-8 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl"></div>
              </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Pricing Section - Horizontal Carousel */}
      <section id="precios" className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-16 flex items-center">
        <div className="w-full">
          {/* Header */}
          <ScrollReveal className="text-center mb-8 px-6">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
              Sin planes. Paga solo lo que necesitas.
            </h2>
            <p className="text-base md:text-lg text-gray-500">
              Desliza y selecciona las funciones que necesitas
            </p>
          </ScrollReveal>
          
          {/* Top: Price Summary + Users - Same width as carousel */}
          <ScrollReveal delay={0.1} className="mb-6">
            <div className="px-4 md:px-12">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Price Summary - Vertical layout with flex grow */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 flex flex-col">
                  {/* Price on top */}
                  <div className="text-center mb-4">
                    <p className="text-gray-500 text-sm mb-1">Tu plan mensual</p>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl md:text-6xl font-black text-gray-900">€{monthlyTotal}</span>
                      <span className="text-lg text-gray-400">/mes</span>
                    </div>
                  </div>
                  
                  {/* User badges */}
                  <div className="flex flex-wrap justify-center gap-1.5 mb-3">
                    {userCounts.employees > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {userCounts.employees} Empleado{userCounts.employees !== 1 ? 's' : ''}
                      </span>
                    )}
                    {userCounts.managers > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {userCounts.managers} Manager{userCounts.managers !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {userCounts.admins} Admin{userCounts.admins !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  {/* Function badges - flex wrap with fixed size badges */}
                  <div className="flex flex-wrap gap-1.5 mb-4 flex-1 content-start">
                    {addons.filter(a => selectedAddons.has(a.key) || a.isLocked).map((addon) => {
                      const IconComponent = addon.icon;
                      return (
                        <span 
                          key={addon.key}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                            addon.isLocked 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          <IconComponent className="w-3 h-3 flex-shrink-0" />
                          {addon.name}
                        </span>
                      );
                    })}
                  </div>
                  
                  {/* CTA Button - Always at bottom */}
                  <div className="mt-auto">
                    {registrationSettings?.publicRegistrationEnabled ? (
                      <Link href="/request-code">
                        <Button className="w-full py-5 text-base font-bold bg-[#007AFF] hover:bg-[#0056CC]">
                          Prueba 7 días gratis
                        </Button>
                      </Link>
                    ) : (
                      <Button 
                        onClick={() => setIsContactFormOpen(true)}
                        className="w-full py-5 text-base font-bold bg-[#007AFF] hover:bg-[#0056CC]"
                      >
                        Contactar
                      </Button>
                    )}
                    <p className="text-center text-xs text-gray-400 mt-2">Sin compromiso • Cancela cuando quieras</p>
                  </div>
                </div>
                
                {/* Users - Card style with descriptions */}
                <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-2 text-center">¿Cuántos usuarios necesitas?</h3>
                  <p className="text-gray-500 text-xs text-center mb-4">Añade usuarios según sus funciones en tu empresa</p>
                  
                  <div className="space-y-4">
                    {/* Employees */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Users className="w-4 h-4 text-blue-600" />
                          </div>
                          <p className="font-semibold text-gray-900">Empleados</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setUserCounts(prev => ({ ...prev, employees: Math.max(0, prev.employees - 1) }))}
                            className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm"
                          >
                            -
                          </button>
                          <input 
                            type="number"
                            min="0"
                            value={userCounts.employees}
                            onChange={(e) => setUserCounts(prev => ({ ...prev, employees: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-10 text-center font-bold text-gray-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button 
                            onClick={() => setUserCounts(prev => ({ ...prev, employees: prev.employees + 1 }))}
                            className="w-7 h-7 rounded-full bg-[#007AFF] hover:bg-[#0056CC] flex items-center justify-center text-white font-bold text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">Fichan entrada/salida, solicitan vacaciones y reciben mensajes</p>
                    </div>
                    
                    {/* Managers */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                            <Shield className="w-4 h-4 text-purple-600" />
                          </div>
                          <p className="font-semibold text-gray-900">Managers</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setUserCounts(prev => ({ ...prev, managers: Math.max(0, prev.managers - 1) }))}
                            className="w-7 h-7 rounded-full bg-white border border-gray-200 hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm"
                          >
                            -
                          </button>
                          <input 
                            type="number"
                            min="0"
                            value={userCounts.managers}
                            onChange={(e) => setUserCounts(prev => ({ ...prev, managers: Math.max(0, parseInt(e.target.value) || 0) }))}
                            className="w-10 text-center font-bold text-gray-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button 
                            onClick={() => setUserCounts(prev => ({ ...prev, managers: prev.managers + 1 }))}
                            className="w-7 h-7 rounded-full bg-[#007AFF] hover:bg-[#0056CC] flex items-center justify-center text-white font-bold text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">Supervisan equipos, aprueban solicitudes y gestionan turnos</p>
                    </div>
                    
                    {/* Admins */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                            <Settings className="w-4 h-4 text-amber-600" />
                          </div>
                          <p className="font-semibold text-gray-900">Admins</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setUserCounts(prev => ({ ...prev, admins: Math.max(1, prev.admins - 1) }))}
                            disabled={userCounts.admins <= 1}
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
                              userCounts.admins <= 1 
                                ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                                : 'bg-white border border-gray-200 hover:bg-gray-100 text-gray-600'
                            }`}
                          >
                            -
                          </button>
                          <input 
                            type="number"
                            min="1"
                            value={userCounts.admins}
                            onChange={(e) => setUserCounts(prev => ({ ...prev, admins: Math.max(1, parseInt(e.target.value) || 1) }))}
                            className="w-10 text-center font-bold text-gray-900 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button 
                            onClick={() => setUserCounts(prev => ({ ...prev, admins: prev.admins + 1 }))}
                            className="w-7 h-7 rounded-full bg-[#007AFF] hover:bg-[#0056CC] flex items-center justify-center text-white font-bold text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">Control total: configuración, facturación y todos los permisos</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
          
          {/* Addon Carousel - Full width */}
          <ScrollReveal delay={0.2} className="mb-8">
            <div className="relative px-4 md:px-12">
              <Carousel 
                className="w-full"
                opts={{ align: 'start', loop: false, dragFree: true }}
              >
                <CarouselContent className="-ml-3">
                  {addons.map((addon) => {
                    const isSelected = selectedAddons.has(addon.key);
                    const IconComponent = addon.icon;
                    const isLocked = addon.isLocked;
                    return (
                      <CarouselItem key={addon.key} className="pl-3 basis-[75%] sm:basis-[45%] md:basis-[32%] lg:basis-[24%]">
                        <button
                          onClick={() => toggleAddon(addon.key)}
                          disabled={isLocked}
                          className={`w-full h-full min-h-[160px] p-4 rounded-2xl text-left transition-all duration-300 border-2 flex flex-col ${
                            isLocked
                              ? 'bg-green-50 border-green-300 hover:border-green-400'
                              : isSelected 
                                ? 'bg-[#007AFF] border-[#007AFF] text-white shadow-lg shadow-blue-500/25 scale-[1.02]' 
                                : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                          }`}
                        >
                          {/* Header with icon and badge */}
                          <div className="flex items-start justify-between mb-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              isLocked ? 'bg-green-500' : isSelected ? 'bg-white/20' : 'bg-gray-100'
                            }`}>
                              <IconComponent className={`w-5 h-5 ${
                                isLocked ? 'text-white' : isSelected ? 'text-white' : 'text-gray-600'
                              }`} />
                            </div>
                            {isLocked ? (
                              <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full font-medium">Gratis</span>
                            ) : isSelected ? (
                              <CheckCircle className="w-6 h-6 text-white" />
                            ) : null}
                          </div>
                          
                          {/* Name */}
                          <h4 className={`font-semibold text-base mb-2 ${
                            isLocked ? 'text-green-800' : isSelected ? 'text-white' : 'text-gray-900'
                          }`}>
                            {addon.name}
                          </h4>
                          
                          {/* Description */}
                          <p className={`text-sm leading-relaxed flex-1 ${
                            isLocked ? 'text-green-700' : isSelected ? 'text-white/90' : 'text-gray-500'
                          }`}>
                            {addon.description}
                          </p>
                          
                          {/* Select indicator */}
                          <div className={`mt-3 text-xs font-medium ${
                            isLocked ? 'text-green-600' : isSelected ? 'text-white/80' : 'text-[#007AFF]'
                          }`}>
                            {isLocked ? '✓ Incluido' : isSelected ? '✓ Seleccionado' : 'Toca para añadir'}
                          </div>
                        </button>
                      </CarouselItem>
                    );
                  })}
                </CarouselContent>
                <CarouselPrevious className="hidden md:flex -left-4 bg-white shadow-lg border-gray-200 hover:bg-gray-50" />
                <CarouselNext className="hidden md:flex -right-4 bg-white shadow-lg border-gray-200 hover:bg-gray-50" />
              </Carousel>
              
              {/* Scroll hint for mobile */}
              <p className="text-center text-xs text-gray-400 mt-4 md:hidden">← Desliza para ver más →</p>
            </div>
          </ScrollReveal>
        </div>
      </section>
      {/* Final CTA Section - Memorable Close */}
      <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#007AFF] via-blue-600 to-indigo-700 relative overflow-hidden py-20 md:py-24">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-400/10 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3"></div>
        </div>
        
        <div className="max-w-5xl mx-auto px-6 lg:px-8 text-center relative z-10">
          <ScrollReveal>
            {/* The Big Question */}
            <p className="text-xl md:text-2xl text-blue-200 font-medium mb-6">
              Una pregunta honesta:
            </p>
            
            {/* Main Statement - The Hook */}
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-white mb-8 tracking-tight leading-[1.1]">
              ¿Cuánto vale<br />
              <span className="bg-gradient-to-r from-cyan-300 via-white to-blue-200 bg-clip-text text-transparent">tu hora?</span>
            </h2>
            
            {/* The Insight */}
            <p className="text-2xl md:text-3xl lg:text-4xl text-white/90 font-semibold mb-6 max-w-4xl mx-auto leading-tight">
              Más que unos euros al mes, seguro.
            </p>
            
            {/* The Philosophy */}
            <p className="text-lg md:text-xl text-blue-100 mb-16 max-w-3xl mx-auto leading-relaxed">
              Cada minuto que pierdes en tareas administrativas es un minuto que no dedicas a lo que realmente importa: 
              <span className="text-white font-semibold"> hacer crecer tu negocio, cuidar a tu equipo, vivir tu vida.</span>
            </p>
          </ScrollReveal>
          
          <ScrollReveal delay={0.2}>
            {/* CTA Button - Massive */}
            {registrationSettings?.publicRegistrationEnabled && (
              <div className="mb-10">
                <Link href="/request-code">
                  <button className="group relative bg-white text-[#007AFF] hover:bg-gray-50 font-black text-xl md:text-2xl px-12 md:px-16 py-6 md:py-7 rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] hover:shadow-[0_30px_80px_-15px_rgba(0,0,0,0.5)] transform hover:scale-105 transition-all duration-300">
                    <span className="relative z-10 flex items-center gap-4">
                      Recupera tu tiempo
                      <ArrowRight className="w-7 h-7 group-hover:translate-x-2 transition-transform duration-300" />
                    </span>
                  </button>
                </Link>
              </div>
            )}
            
            {/* Closing Line */}
            <p className="text-blue-200/80 text-base md:text-lg font-medium">
              7 días gratis. Sin tarjeta. Sin compromiso.
            </p>
          </ScrollReveal>
        </div>
      </section>
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-6">
                <img 
                  src={oficazWhiteLogo} 
                  alt="Oficaz" 
                  className="h-8 w-auto"
                  loading="lazy"
                />
              </div>
              <p className="text-gray-400 mb-4">
                La plataforma de gestión empresarial más intuitiva para empresas modernas.
              </p>
              <div className="text-sm text-gray-500">
                © 2025 Oficaz. Todos los derechos reservados.
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Producto</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Funciones</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Precios</a></li>
                <li><a href="/request-code" className="hover:text-white transition-colors">Prueba Gratis</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Política de Privacidad</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Términos de Servicio</Link></li>
                <li><Link href="/cookies" className="hover:text-white transition-colors">Política de Cookies</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>Oficaz - Gestión empresarial inteligente para empresas que lo quieren fácil</p>
          </div>
        </div>
      </footer>
      {/* Contact Form Modal - Lazy loaded */}
      {isContactFormOpen && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-lg p-6">Cargando...</div></div>}>
          <ContactForm 
            isOpen={isContactFormOpen} 
            onClose={() => setIsContactFormOpen(false)} 
          />
        </Suspense>
      )}
    </div>
  );
}