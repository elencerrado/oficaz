import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, MapPin, Calendar } from "lucide-react";
import { format, addDays, subDays, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useFeatureCheck } from "@/hooks/use-feature-check";
import { EmployeeTopBar } from "@/components/employee/employee-top-bar";

interface WorkShift {
  id: number;
  employeeId: number;
  startAt: string;
  endAt: string;
  title: string;
  location?: string;
  notes?: string;
  color: string;
  employeeName?: string;
}

interface VacationRequest {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  status: "pending" | "approved" | "denied";
  userName?: string;
}

interface Holiday {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  type: "national" | "regional" | "local";
  region?: string;
}

export default function EmployeeSchedule() {
  const { user, company } = useAuth();
  const [location] = useLocation();
  const { hasAccess } = useFeatureCheck();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("day");

  const urlParts = location.split("/").filter((part) => part.length > 0);
  const companyAlias = urlParts[0] || company?.companyAlias || "test";

  const shouldShowLogo = company?.logoUrl && hasAccess("logoUpload");

  const {
    data: shifts = [],
    isLoading: shiftsLoading,
    isFetching: shiftsFetching,
    refetch: refetchShifts,
  } = useQuery<WorkShift[]>({
    queryKey: ["/api/work-shifts/my-shifts"],
    queryFn: async () => apiRequest("GET", "/api/work-shifts/my-shifts"),
    enabled: !!user,
    staleTime: 30000,
  });

  const { data: vacationRequests = [] } = useQuery<VacationRequest[]>({
    queryKey: ["/api/vacation-requests"],
    enabled: !!user,
    staleTime: 60000,
  });

  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ["/api/holidays/custom"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const isInitialLoading = shiftsLoading && shifts.length === 0;

  const navigate = (direction: "prev" | "next") => {
    if (viewMode === "day") {
      setCurrentDate((prev) => (direction === "prev" ? subDays(prev, 1) : addDays(prev, 1)));
    } else {
      setCurrentDate((prev) => (direction === "prev" ? subWeeks(prev, 1) : addWeeks(prev, 1)));
    }
  };

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const getShiftsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return shifts.filter((shift) => format(parseISO(shift.startAt), "yyyy-MM-dd") === dateStr);
  };

  const getGoogleMapsLink = (address: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  const isOnVacation = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return vacationRequests.find((request) => {
      if (request.status !== "approved") return false;
      const startDate = format(parseISO(request.startDate), "yyyy-MM-dd");
      const endDate = format(parseISO(request.endDate), "yyyy-MM-dd");
      return startDate <= dateStr && endDate >= dateStr;
    });
  };

  const isHoliday = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return holidays.find((holiday) => {
      const startDate = format(parseISO(holiday.startDate), "yyyy-MM-dd");
      const endDate = format(parseISO(holiday.endDate), "yyyy-MM-dd");
      return startDate <= dateStr && endDate >= dateStr;
    });
  };

  const renderShiftBadge = (shift: WorkShift) => {
    const startTime = format(parseISO(shift.startAt), "HH:mm");
    const endTime = format(parseISO(shift.endAt), "HH:mm");

    return (
      <div
        key={shift.id}
        className="p-3 rounded-xl text-white shadow-sm border border-white/20 backdrop-blur-sm"
        style={{ backgroundColor: shift.color }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-sm truncate pr-2">{shift.title}</span>
          <div className="flex items-center text-xs bg-black/20 px-2 py-1 rounded-lg whitespace-nowrap">
            <Clock className="w-3 h-3 mr-1" />
            {startTime}-{endTime}
          </div>
        </div>

        {shift.location && (
          <a
            href={getGoogleMapsLink(shift.location)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-xs opacity-90 mb-1 hover:opacity-100 hover:underline transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
            <span className="truncate">{shift.location}</span>
          </a>
        )}

        {shift.notes && <div className="text-xs opacity-80 mt-1.5 bg-black/20 p-2 rounded-lg">{shift.notes}</div>}
      </div>
    );
  };

  const getCellContent = (date: Date) => {
    const vacation = isOnVacation(date);
    const holiday = isHoliday(date);

    if (vacation) {
      return (
        <div className="h-full flex items-center justify-center p-4">
          <div className="bg-blue-100 dark:bg-blue-500/20 border border-blue-300 dark:border-blue-500/30 rounded-xl p-4 text-center backdrop-blur-sm">
            <div className="text-blue-700 dark:text-blue-300 font-medium mb-1">Vacaciones</div>
            <div className="text-blue-600 dark:text-blue-200 text-xs">Disfruta tu descanso</div>
          </div>
        </div>
      );
    }

    if (holiday) {
      return (
        <div className="h-full flex items-center justify-center p-4">
          <div className="bg-orange-100 dark:bg-orange-500/20 border border-orange-300 dark:border-orange-500/30 rounded-xl p-4 text-center backdrop-blur-sm">
            <div className="text-orange-700 dark:text-orange-300 font-medium mb-1">{holiday.name}</div>
            <div className="text-orange-600 dark:text-orange-200 text-xs">Dia festivo</div>
          </div>
        </div>
      );
    }

    return null;
  };

  const dayShifts = getShiftsForDate(currentDate);
  const isToday = format(new Date(), "yyyy-MM-dd") === format(currentDate, "yyyy-MM-dd");

  return (
    <div className="bg-gray-50 dark:bg-employee-gradient text-gray-900 dark:text-white min-h-screen" style={{ overscrollBehavior: "none" }}>
      <EmployeeTopBar homeHref={`/${companyAlias}/inicio`} />

      <div className="px-6 pb-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Cuadrante</h1>
        <p className="text-gray-600 dark:text-white/70 text-sm">Consulta tus horarios y turnos asignados</p>
      </div>

      <div className="px-4 mb-4">
        <div className="bg-white dark:bg-white/10 backdrop-blur-sm rounded-2xl p-1 border border-gray-200 dark:border-white/20 flex gap-1">
          <Button
            variant="ghost"
            onClick={() => setViewMode("day")}
            className={`flex-1 rounded-xl transition-all ${
              viewMode === "day"
                ? "bg-gray-200 dark:bg-white/20 text-gray-900 dark:text-white font-medium"
                : "text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10"
            }`}
          >
            <CalendarClock className="w-4 h-4 mr-2" />
            Dia
          </Button>
          <Button
            variant="ghost"
            onClick={() => setViewMode("week")}
            className={`flex-1 rounded-xl transition-all ${
              viewMode === "week"
                ? "bg-gray-200 dark:bg-white/20 text-gray-900 dark:text-white font-medium"
                : "text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10"
            }`}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Semana
          </Button>
        </div>
      </div>

      <div className="px-4 mb-4">
        <div className="bg-white dark:bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-gray-200 dark:border-white/20">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("prev")}
              className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 w-12 h-12 rounded-full p-0 flex items-center justify-center"
              data-testid="button-prev"
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>

            <div className="text-center flex-1 px-2">
              {viewMode === "day" ? (
                <>
                  <div className="text-sm font-medium text-gray-600 dark:text-white/80 leading-tight capitalize">
                    {format(currentDate, "EEEE", { locale: es })}
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                    {format(currentDate, "d MMM", { locale: es })}
                  </div>
                  {isToday && (
                    <Badge variant="secondary" className="mt-1 bg-blue-500 text-white border-blue-400 text-xs px-2 py-0.5">
                      HOY
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <div className="text-sm font-medium text-gray-600 dark:text-white/80 leading-tight">Semana</div>
                  <div className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                    {format(weekDays[0], "d", { locale: es })} - {format(weekDays[6], "d MMM", { locale: es })}
                  </div>
                </>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("next")}
              className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/20 w-12 h-12 rounded-full p-0 flex items-center justify-center"
              data-testid="button-next"
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </div>

      {viewMode === "day" ? (
        <div className="px-4 mb-4">
          <div className="bg-white dark:bg-white/10 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-white/20 min-h-[320px]">
            {isInitialLoading ? (
              <div className="p-4 space-y-4 animate-pulse">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="space-y-2">
                  <div className="h-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
                  <div className="h-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
                </div>
              </div>
            ) : (
              <>
                {getCellContent(currentDate)}

                {dayShifts.length > 0 && (
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
                      <CalendarClock className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                      {getCellContent(currentDate) ? "Turnos (dia especial)" : "Turnos de hoy"} ({dayShifts.length})
                    </h3>
                    <div className="space-y-2">{dayShifts.map((shift) => renderShiftBadge(shift))}</div>
                  </div>
                )}

                {dayShifts.length === 0 && !getCellContent(currentDate) && (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <CalendarClock className="w-12 h-12 text-gray-300 dark:text-white/30 mb-3" />
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1 text-sm">Sin turnos</h3>
                    <p className="text-xs text-gray-600 dark:text-white/70">No hay horarios para este dia</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="px-4 mb-4">
          <div className="space-y-2">
            {weekDays.map((day, index) => {
              const dayShiftsForDay = getShiftsForDate(day);
              const isTodayWeek = format(new Date(), "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
              const specialContent = getCellContent(day);

              return (
                <div
                  key={index}
                  className={`bg-white dark:bg-white/10 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-white/20 overflow-hidden ${
                    isTodayWeek ? "ring-2 ring-blue-500 dark:ring-blue-400/50" : ""
                  }`}
                >
                  <div
                    className={`px-4 py-2 flex items-center justify-between ${
                      isTodayWeek ? "bg-blue-100 dark:bg-blue-500/20" : "bg-gray-50 dark:bg-white/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="text-gray-900 dark:text-white font-medium text-sm capitalize">
                        {format(day, "EEEE", { locale: es })}
                      </div>
                      <div className="text-gray-600 dark:text-white/70 text-xs">{format(day, "d MMM", { locale: es })}</div>
                      {isTodayWeek && (
                        <Badge variant="secondary" className="bg-blue-500 text-white border-blue-400 text-xs px-2 py-0.5">
                          HOY
                        </Badge>
                      )}
                    </div>
                    <div className="text-gray-500 dark:text-white/60 text-xs">
                      {dayShiftsForDay.length > 0
                        ? `${dayShiftsForDay.length} turno${dayShiftsForDay.length > 1 ? "s" : ""}`
                        : ""}
                    </div>
                  </div>

                  <div className="px-4 py-3">
                    {isInitialLoading ? (
                      <div className="space-y-2 animate-pulse">
                        <div className="h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
                        <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                      </div>
                    ) : specialContent ? (
                      <div className="py-2">{specialContent}</div>
                    ) : dayShiftsForDay.length > 0 ? (
                      <div className="space-y-2">
                        {dayShiftsForDay.map((shift) => {
                          const startTime = format(parseISO(shift.startAt), "HH:mm");
                          const endTime = format(parseISO(shift.endAt), "HH:mm");

                          return (
                            <div
                              key={shift.id}
                              className="p-2 rounded-lg text-white text-xs border border-white/20 dark:border-white/20"
                              style={{ backgroundColor: shift.color }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium truncate pr-2">{shift.title}</span>
                                <div className="flex items-center bg-black/20 px-2 py-0.5 rounded whitespace-nowrap">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {startTime}-{endTime}
                                </div>
                              </div>
                              {shift.location && (
                                <a
                                  href={getGoogleMapsLink(shift.location)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center mt-1 opacity-90 hover:opacity-100 hover:underline transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                                  <span className="truncate text-xs">{shift.location}</span>
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-3 text-gray-400 dark:text-white/40 text-xs">Sin turnos</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="px-4 mb-4">
        <div className="flex gap-3">
          {(viewMode === "day" ? !isToday : true) && (
            <Button
              variant="ghost"
              onClick={() => setCurrentDate(new Date())}
              className="bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 text-gray-900 dark:text-white border border-gray-200 dark:border-white/20 backdrop-blur-sm rounded-xl py-2.5 px-4 text-sm flex-1"
            >
              {viewMode === "day" ? "Hoy" : "Esta semana"}
            </Button>
          )}
          <Button
            variant="ghost"
            className="bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 text-gray-900 dark:text-white border border-gray-200 dark:border-white/20 backdrop-blur-sm rounded-xl py-2.5 px-4 text-sm flex-1"
            onClick={() => refetchShifts()}
            disabled={shiftsFetching}
          >
            <Clock className="w-4 h-4 mr-1" />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="text-center pb-4 mt-auto">
        <div className="flex items-center justify-center space-x-1 text-gray-500 dark:text-white/60 text-xs">
          <span className="font-semibold text-blue-500 dark:text-blue-400">Oficaz</span>
          <span> {new Date().getFullYear()}</span>
        </div>
      </div>
    </div>
  );
}
