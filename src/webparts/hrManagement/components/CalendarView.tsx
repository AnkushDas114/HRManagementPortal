import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';

export interface CalendarViewEvent {
  id: string | number;
  title: string;
  startDate: string;
  endDate?: string;
  color?: string;
  subtitle?: string;
  status?: string;
  referenceId?: string | number;
  raw?: unknown;
}

type CalendarMode = 'month' | 'week' | 'day' | 'agenda';

interface CalendarViewProps {
  heading: string;
  events: CalendarViewEvent[];
  showCreate?: boolean;
  showConcern?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
  onCreate?: (date: string) => void;
  onConcern?: (event: CalendarViewEvent, date: string) => void;
  onEdit?: (event: CalendarViewEvent) => void;
  onDelete?: (event: CalendarViewEvent) => void;
}

const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const parseYmd = (value: string): Date => {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

const startOfWeekMonday = (date: Date): Date => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  const mondayIndex = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayIndex);
  return d;
};

const formatKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isInRange = (target: string, start: string, end: string): boolean => {
  return target >= start && target <= end;
};

const MAX_VISIBLE_MONTH_LANES = 2;
const MONTH_CELL_MIN_HEIGHT = 112;
const MONTH_EVENT_TOP = 20;
const MONTH_EVENT_HEIGHT = 20;
const MONTH_EVENT_GAP = 2;
const MONTH_MORE_TOP = MONTH_EVENT_TOP + (MAX_VISIBLE_MONTH_LANES * (MONTH_EVENT_HEIGHT + MONTH_EVENT_GAP)) + 2;
const getEventStatus = (event: CalendarViewEvent): string => {
  if (event.status) return String(event.status);
  const raw = event.raw as { status?: string } | undefined;
  return String(raw?.status || '-');
};

const CalendarView: React.FC<CalendarViewProps> = ({
  heading,
  events,
  showCreate = false,
  showConcern = false,
  showEdit = false,
  showDelete = false,
  onCreate,
  onConcern,
  onEdit,
  onDelete
}) => {
  const [mode, setMode] = React.useState<CalendarMode>('month');
  const [cursor, setCursor] = React.useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = React.useState<string>('');
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarViewEvent | null>(null);
  const [expandedDate, setExpandedDate] = React.useState<string>('');
  const [expandedEvents, setExpandedEvents] = React.useState<CalendarViewEvent[]>([]);

  const normalizedEvents = React.useMemo(() => {
    return events.map((event) => {
      const start = formatKey(parseYmd(event.startDate));
      const end = formatKey(parseYmd(event.endDate || event.startDate));
      return {
        ...event,
        startDate: start,
        endDate: end < start ? start : end
      };
    });
  }, [events]);

  const rangeDates = React.useMemo(() => {
    if (mode === 'week') {
      const weekStart = startOfWeekMonday(cursor);
      return Array.from({ length: 7 }).map((_, index) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + index);
        return d;
      });
    }
    if (mode === 'day') {
      return [new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 12, 0, 0)];
    }
    return [];
  }, [cursor, mode]);

  const periodLabel = React.useMemo(() => {
    if (mode === 'day') return cursor.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (mode === 'week') {
      const start = startOfWeekMonday(cursor);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [cursor, mode]);

  const agendaEvents = React.useMemo(() => {
    const rangeStart = mode === 'month'
      ? formatKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12, 0, 0))
      : mode === 'week'
        ? formatKey(startOfWeekMonday(cursor))
        : formatKey(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 12, 0, 0));
    const rangeEnd = mode === 'month'
      ? formatKey(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 12, 0, 0))
      : mode === 'week'
        ? formatKey(new Date(startOfWeekMonday(cursor).getFullYear(), startOfWeekMonday(cursor).getMonth(), startOfWeekMonday(cursor).getDate() + 6, 12, 0, 0))
        : rangeStart;

    return normalizedEvents
      .filter((event) => !(event.endDate < rangeStart || event.startDate > rangeEnd))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [cursor, mode, normalizedEvents]);

  const navigate = React.useCallback((direction: -1 | 1) => {
    setCursor((prev) => {
      const next = new Date(prev);
      if (mode === 'month') next.setMonth(prev.getMonth() + direction);
      else if (mode === 'week') next.setDate(prev.getDate() + (7 * direction));
      else if (mode === 'day') next.setDate(prev.getDate() + direction);
      else next.setMonth(prev.getMonth() + direction);
      return next;
    });
  }, [mode]);

  const handleDayAction = (dateKey: string): void => {
    setSelectedDate(dateKey);
    setSelectedEvent(null);
  };

  const handleEventClick = React.useCallback((event: CalendarViewEvent, dateKey: string): void => {
    const isHolidayEvent = String(event.id).indexOf('holiday-') === 0;
    if (isHolidayEvent && showEdit && onEdit) {
      onEdit(event);
      return;
    }
    setSelectedEvent(event);
    setSelectedDate(dateKey);
  }, [onEdit, showEdit]);

  const openDayEvents = React.useCallback((dateKey: string): void => {
    const items = normalizedEvents
      .filter((event) => isInRange(dateKey, event.startDate, event.endDate || event.startDate))
      .sort((a, b) => a.title.localeCompare(b.title));
    setExpandedDate(dateKey);
    setExpandedEvents(items);
  }, [normalizedEvents]);

  const formatDisplayDate = React.useCallback((dateKey: string): string => {
    const parsed = parseYmd(dateKey);
    if (Number.isNaN(parsed.getTime())) return dateKey;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, []);

  const formatShortDate = React.useCallback((dateKey: string): string => {
    const parsed = parseYmd(dateKey);
    if (Number.isNaN(parsed.getTime())) return dateKey;
    return parsed.toLocaleDateString('en-GB');
  }, []);

  const monthWeeks = React.useMemo(() => {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12, 0, 0);
    const gridStart = startOfWeekMonday(monthStart);

    return Array.from({ length: 6 }).map((_, weekIndex) => {
      const weekDays = Array.from({ length: 7 }).map((__, dayIndex) => {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + (weekIndex * 7) + dayIndex);
        return {
          date,
          key: formatKey(date),
          isOtherMonth: date.getMonth() !== cursor.getMonth()
        };
      });

      const weekStartKey = weekDays[0].key;
      const weekEndKey = weekDays[6].key;

      const weekEvents = normalizedEvents
        .filter((event) => !(event.endDate < weekStartKey || event.startDate > weekEndKey))
        .map((event) => {
          const clippedStart = event.startDate < weekStartKey ? weekStartKey : event.startDate;
          const clippedEnd = event.endDate > weekEndKey ? weekEndKey : event.endDate;
          const startIndex = weekDays.findIndex((day) => day.key === clippedStart);
          const endIndex = weekDays.findIndex((day) => day.key === clippedEnd);
          return {
            event,
            startIndex,
            endIndex
          };
        })
        .filter((segment) => segment.startIndex >= 0 && segment.endIndex >= 0)
        .sort((a, b) => {
          if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
          const aSpan = a.endIndex - a.startIndex;
          const bSpan = b.endIndex - b.startIndex;
          if (aSpan !== bSpan) return bSpan - aSpan;
          return a.event.title.localeCompare(b.event.title);
        });

      const laneUsage: Array<Array<{ startIndex: number; endIndex: number }>> = [];
      const segments = weekEvents.map((segment) => {
        let lane = 0;
        while (lane < laneUsage.length) {
          const overlaps = laneUsage[lane].some(
            (used) => !(segment.endIndex < used.startIndex || segment.startIndex > used.endIndex)
          );
          if (!overlaps) break;
          lane += 1;
        }
        if (!laneUsage[lane]) laneUsage[lane] = [];
        laneUsage[lane].push({ startIndex: segment.startIndex, endIndex: segment.endIndex });
        return {
          ...segment,
          lane
        };
      });

      const hiddenCountByDay = weekDays.map((__, dayIndex) => (
        segments.filter((segment) => segment.lane >= MAX_VISIBLE_MONTH_LANES && dayIndex >= segment.startIndex && dayIndex <= segment.endIndex).length
      ));

      return {
        weekIndex,
        weekDays,
        visibleSegments: segments.filter((segment) => segment.lane < MAX_VISIBLE_MONTH_LANES),
        hiddenCountByDay
      };
    });
  }, [cursor, normalizedEvents]);

  return (
    <div className="card shadow-sm border-0 mb-4">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-sm btn-default" onClick={() => setCursor(new Date())}>Today</button>
            <button type="button" className="btn btn-sm btn-default" onClick={() => navigate(-1)}>Back</button>
            <button type="button" className="btn btn-sm btn-default" onClick={() => navigate(1)}>Next</button>
          </div>
          <div className="fw-bold">{periodLabel}</div>
          <div className="d-flex gap-2">
            <button type="button" className={`btn btn-sm ${mode === 'month' ? 'btn-primary' : 'btn-default'}`} onClick={() => setMode('month')}>Month</button>
            <button type="button" className={`btn btn-sm ${mode === 'week' ? 'btn-primary' : 'btn-default'}`} onClick={() => setMode('week')}>Week</button>
            <button type="button" className={`btn btn-sm ${mode === 'day' ? 'btn-primary' : 'btn-default'}`} onClick={() => setMode('day')}>Day</button>
            <button type="button" className={`btn btn-sm ${mode === 'agenda' ? 'btn-primary' : 'btn-default'}`} onClick={() => setMode('agenda')}>Agenda</button>
          </div>
        </div>
        <div className="small text-muted mb-2">{heading}</div>

        {mode === 'month' && (
          <div className="border overflow-hidden" style={{ width: '100%' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                borderBottom: '1px solid #d8dee6'
              }}
            >
              {dayHeaders.map((day, dayIndex) => (
                <div
                  key={`month-header-${day}`}
                  className="text-center small fw-bold py-1"
                  style={{
                    borderRight: dayIndex === 6 ? 'none' : '1px solid #d8dee6',
                    boxSizing: 'border-box'
                  }}
                >
                  {day}
                </div>
              ))}
            </div>
            {monthWeeks.map((week) => (
              <div key={`week-${week.weekIndex}`} className="position-relative" style={{ minHeight: MONTH_CELL_MIN_HEIGHT }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                  {week.weekDays.map((day, dayIndex) => (
                    <div
                      key={`day-${day.key}`}
                      className="p-1"
                      style={{
                        background: day.isOtherMonth ? '#ececec' : '#fff',
                        cursor: 'pointer',
                        borderRight: dayIndex === 6 ? 'none' : '1px solid #d8dee6',
                        borderBottom: '1px solid #d8dee6',
                        boxSizing: 'border-box',
                        minHeight: MONTH_CELL_MIN_HEIGHT
                      }}
                      onClick={() => handleDayAction(day.key)}
                    >
                      <div className="small text-muted text-end" style={{ lineHeight: 1 }}>{day.date.getDate()}</div>
                    </div>
                  ))}
                </div>
                <div className="position-absolute top-0 start-0 w-100 h-100" style={{ pointerEvents: 'none' }}>
                  {week.visibleSegments.map((segment) => {
                    const spanDays = segment.endIndex - segment.startIndex + 1;
                    return (
                      <button
                        type="button"
                        key={`segment-${segment.event.id}-${segment.startIndex}-${segment.endIndex}-${segment.lane}`}
                        className="btn p-0 text-start small text-white"
                        style={{
                          position: 'absolute',
                          top: MONTH_EVENT_TOP + (segment.lane * (MONTH_EVENT_HEIGHT + MONTH_EVENT_GAP)),
                          left: `calc(${(segment.startIndex / 7) * 100}% + 1px)`,
                          width: `calc(${(spanDays / 7) * 100}% - 2px)`,
                          height: MONTH_EVENT_HEIGHT,
                          background: segment.event.color || '#5f8fbd',
                          borderRadius: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          pointerEvents: 'auto'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(segment.event, segment.event.startDate);
                        }}
                        title={segment.event.title}
                      >
                        <span className="px-1">{segment.event.title}</span>
                      </button>
                    );
                  })}
                  {week.hiddenCountByDay.map((hiddenCount, dayIndex) => {
                    if (hiddenCount <= 0) return null;
                    return (
                      <button
                        type="button"
                        key={`more-${week.weekIndex}-${dayIndex}`}
                        className="btn btn-link p-0 small fw-bold text-primary"
                        style={{
                          position: 'absolute',
                          top: MONTH_MORE_TOP,
                          left: `calc(${(dayIndex / 7) * 100}% + 6px)`,
                          pointerEvents: 'auto'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openDayEvents(week.weekDays[dayIndex].key);
                        }}
                      >
                        +{hiddenCount} more
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {(mode === 'week' || mode === 'day') && (
          <>
            <div className="row g-0 border">
              {dayHeaders.slice(0, mode === 'day' ? 1 : 7).map((day) => (
                <div key={day} className={`col border-end small fw-bold text-center py-2 ${mode === 'day' ? 'col-12' : ''}`}>{day}</div>
              ))}
            </div>
            <div className="row g-0 border-start border-end border-bottom">
              {rangeDates.map((date) => {
                const dateKey = formatKey(date);
                const items = normalizedEvents.filter((event) => isInRange(dateKey, event.startDate, event.endDate || event.startDate));
                const visible = items.slice(0, 2);
                const moreCount = items.length - visible.length;
                return (
                  <div
                    key={`${dateKey}-${mode}`}
                    className={`${mode === 'day' ? 'col-12' : 'col'} border-end border-bottom p-1`}
                    style={{ minHeight: mode === 'day' ? 280 : 120, background: '#fff', cursor: 'pointer' }}
                    onClick={() => handleDayAction(dateKey)}
                  >
                    <div className="small text-muted text-end mb-1">{date.getDate()}</div>
                    {visible.map((event) => (
                      <div
                        key={`${event.id}-${dateKey}`}
                        className="small text-white px-2 py-1 mb-1"
                        style={{ background: event.color || '#5f8fbd', borderRadius: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event, dateKey);
                        }}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {moreCount > 0 && (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDayEvents(dateKey);
                        }}
                      >
                        +{moreCount} more
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {mode === 'agenda' && (
          <div className="border rounded p-2" style={{ maxHeight: 420, overflowY: 'auto' }}>
            {agendaEvents.length === 0 && <div className="text-muted small">No events in this period.</div>}
            {agendaEvents.map((event) => (
              <button
                type="button"
                key={`agenda-${event.id}-${event.startDate}`}
                className="btn w-100 text-start mb-2"
                style={{ background: '#f8fbff' }}
                onClick={() => {
                  handleEventClick(event, event.startDate);
                }}
              >
                <div className="fw-bold small">{event.title}</div>
                <div className="small text-muted">{event.startDate}{event.endDate && event.endDate !== event.startDate ? ` - ${event.endDate}` : ''}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={!!expandedDate}
        onClose={() => {
          setExpandedDate('');
          setExpandedEvents([]);
        }}
        title={`${heading.replace(/\s*Calendar$/i, '')} of ${formatDisplayDate(expandedDate)}`}
        size="lg"
        scrollable
        footer={<button className="btn btn-default" onClick={() => { setExpandedDate(''); setExpandedEvents([]); }}>Close</button>}
      >
        {expandedEvents.length === 0 ? (
          <div className="small text-muted">No entries found.</div>
        ) : (
          <div className="table-responsive border rounded">
            <table className="table table-sm mb-0 align-middle">
              <thead style={{ background: '#0e9a83' }}>
                <tr>
                  <th className="text-white fw-semibold py-2">Title</th>
                  <th className="text-white fw-semibold py-2" style={{ width: 140 }}>EndDate</th>
                  <th className="text-white fw-semibold py-2" style={{ width: 120 }}>Status</th>
                  {showEdit && onEdit && <th className="text-white fw-semibold py-2 text-center" style={{ width: 64 }}>Edit</th>}
                  {showDelete && onDelete && <th className="text-white fw-semibold py-2 text-center" style={{ width: 64 }}>Delete</th>}
                </tr>
              </thead>
              <tbody>
                {expandedEvents.map((event) => (
                  <tr key={`expanded-${expandedDate}-${event.id}`} style={{ borderBottom: '1px solid #edf1f6' }}>
                    <td className="small py-2">{event.title}</td>
                    <td className="small py-2">{formatShortDate(event.endDate || event.startDate)}</td>
                    <td className="small py-2">{getEventStatus(event)}</td>
                    {showEdit && onEdit && (
                      <td className="text-center py-2">
                        <button
                          type="button"
                          className="btn btn-sm p-0 border-0 bg-transparent"
                          title="Edit"
                          aria-label="Edit"
                          style={{ color: '#2f5596' }}
                          onClick={() => {
                            setExpandedDate('');
                            setExpandedEvents([]);
                            onEdit(event);
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    )}
                    {showDelete && onDelete && (
                      <td className="text-center py-2">
                        <button
                          type="button"
                          className="btn btn-sm p-0 border-0 bg-transparent"
                          title="Delete"
                          aria-label="Delete"
                          style={{ color: '#d14b64' }}
                          onClick={() => {
                            setExpandedDate('');
                            setExpandedEvents([]);
                            onDelete(event);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!selectedDate}
        onClose={() => {
          setSelectedDate('');
          setSelectedEvent(null);
        }}
        title="Calendar Actions"
        size="sm"
        scrollable={false}
        footer={
          <>
            <button className="btn btn-default" onClick={() => { setSelectedDate(''); setSelectedEvent(null); }}>Close</button>
          </>
        }
      >
        <div className="text-muted mb-3">Date: {selectedDate}</div>
        <div className="d-flex flex-wrap gap-2">
          {showCreate && onCreate && (
            <button className="btn btn-primary btn-sm" onClick={() => onCreate(selectedDate)}>New Request</button>
          )}
          {showConcern && onConcern && (
            <button
              className="btn btn-default btn-sm"
              onClick={() => {
                const fallbackEvent: CalendarViewEvent = selectedEvent || {
                  id: `date-${selectedDate}`,
                  title: selectedDate,
                  startDate: selectedDate,
                  referenceId: selectedDate
                };
                onConcern(fallbackEvent, selectedDate);
              }}
            >
              Raise Concern
            </button>
          )}
          {showEdit && onEdit && selectedEvent && (
            <button className="btn btn-primary btn-sm" onClick={() => onEdit(selectedEvent)}>Edit</button>
          )}
          {showDelete && onDelete && selectedEvent && (
            <button className="btn btn-default btn-sm" onClick={() => onDelete(selectedEvent)}>Delete</button>
          )}
        </div>
        {selectedEvent && (
          <div className="mt-3 p-2 border rounded">
            <div className="fw-bold small">{selectedEvent.title}</div>
            {selectedEvent.subtitle && <div className="small text-muted">{selectedEvent.subtitle}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CalendarView;
