import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Copy,
  Edit2,
  Globe,
  Grid3x3,
  MapPin,
  MonitorSmartphone,
  Plus,
  RotateCw,
  Trash2,
  Workflow,
} from 'lucide-react';
import { withDashboard } from '@/components/DashboardLayout';
import { ConfirmDialog, Modal } from '@/components/Modal';
import apiClient from '@/services/api';
import { KioskTerminal, Workplace } from '@/types';
import { formatDateTime } from '@/utils/formatters';

type NodeType = 'country' | 'city' | 'district' | 'branch';
type CreateLevel = 'country' | 'city' | 'district' | 'branch';
type OrgEntityRoute = 'countries' | 'cities' | 'districts' | 'branches';

interface NodeStats {
  cities: number;
  districts: number;
  branches: number;
  workplaces: number;
  terminals: number;
  services: number;
}

interface TreeNode {
  id: string;
  type: NodeType;
  name: string;
  createdAt: string;
  countryId?: string;
  cityId?: string;
  districtId?: string;
  children: TreeNode[];
  stats: NodeStats;
  workplaces: Workplace[];
  terminals: KioskTerminal[];
  serviceNames: string[];
}

interface FragmentRowProps {
  child: TreeNode;
  columns: string[];
  expanded: boolean;
  renderCell: (child: TreeNode, column: string) => React.ReactNode;
  renderExpanded: () => React.ReactNode;
}

const iconByType = {
  country: Globe,
  city: MapPin,
  district: Grid3x3,
  branch: Building2,
} satisfies Record<NodeType, typeof Globe>;

const labelByType = {
  country: 'Країна',
  city: 'Місто',
  district: 'Район',
  branch: 'Філія',
} satisfies Record<NodeType, string>;

const routeByType = {
  country: 'countries',
  city: 'cities',
  district: 'districts',
  branch: 'branches',
} satisfies Record<NodeType, OrgEntityRoute>;

const emptyStats = (): NodeStats => ({
  cities: 0,
  districts: 0,
  branches: 0,
  workplaces: 0,
  terminals: 0,
  services: 0,
});

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, 'uk'));
}

function aggregateNode(node: TreeNode): TreeNode {
  if (node.type === 'branch') {
    const serviceNames = uniq(node.workplaces.map((workplace) => workplace.serviceName ?? ''));
    return {
      ...node,
      serviceNames,
      stats: {
        cities: 0,
        districts: 0,
        branches: 1,
        workplaces: node.workplaces.length,
        terminals: node.terminals.length,
        services: serviceNames.length,
      },
    };
  }

  const children = node.children.map(aggregateNode);
  const serviceNames = uniq(children.flatMap((child) => child.serviceNames));

  return {
    ...node,
    children,
    serviceNames,
    stats: {
      cities: (node.type === 'city' ? 1 : 0) + children.reduce((sum, child) => sum + child.stats.cities, 0),
      districts: (node.type === 'district' ? 1 : 0) + children.reduce((sum, child) => sum + child.stats.districts, 0),
      branches: children.reduce((sum, child) => sum + child.stats.branches, 0),
      workplaces: children.reduce((sum, child) => sum + child.stats.workplaces, 0),
      terminals: children.reduce((sum, child) => sum + child.stats.terminals, 0),
      services: serviceNames.length,
    },
  };
}

function FragmentRow({ child, columns, expanded, renderCell, renderExpanded }: FragmentRowProps) {
  return (
    <>
      <tr className="group border-b border-gray-100 align-top transition hover:bg-gray-50">
        {columns.map((column) => (
          <td key={column} className="px-4 py-3 text-gray-700">
            {renderCell(child, column)}
          </td>
        ))}
      </tr>
      {expanded && (
        <tr className="border-b border-gray-100 bg-gray-50/50">
          <td colSpan={columns.length} className="px-4 py-4">
            {renderExpanded()}
          </td>
        </tr>
      )}
    </>
  );
}

function OrgStructurePage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLevel, setCreateLevel] = useState<CreateLevel>('country');
  const [parentForCreate, setParentForCreate] = useState<TreeNode | null>(null);

  const [editingEntity, setEditingEntity] = useState<TreeNode | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteConfirmEntity, setDeleteConfirmEntity] = useState<TreeNode | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  const [formData, setFormData] = useState({ name: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyStateId, setCopyStateId] = useState<string | null>(null);
  const [rotatingTerminalId, setRotatingTerminalId] = useState<string | null>(null);

  const openCreateModal = (level: CreateLevel, parent?: TreeNode) => {
    setCreateLevel(level);
    setParentForCreate(parent ?? null);
    setFormData({ name: '' });
    setFormErrors({});
    setIsCreateModalOpen(true);
  };

  const openEditModal = (node: TreeNode) => {
    setEditingEntity(node);
    setFormData({ name: node.name });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  const closeModals = () => {
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setEditingEntity(null);
    setParentForCreate(null);
    setCreateLevel('country');
    setFormData({ name: '' });
    setFormErrors({});
  };

  const loadAndBuildTree = useCallback(async () => {
    try {
      setLoading(true);

      const [countries, cities, districts, branches, workplacesResponse, terminalsResponse] = await Promise.all([
        apiClient.getCountries(),
        apiClient.getCities(),
        apiClient.getDistricts(),
        apiClient.getBranches(),
        apiClient.getWorkplaces({ page: 1, limit: 500 }),
        apiClient.getKioskTerminals(),
      ]);

      const workplaces = workplacesResponse.data ?? [];
      const terminals = terminalsResponse.data ?? [];

      const workplacesByBranch = new Map<string, Workplace[]>();
      workplaces.forEach((workplace) => {
        const current = workplacesByBranch.get(workplace.branchId) ?? [];
        current.push(workplace);
        workplacesByBranch.set(workplace.branchId, current);
      });

      const terminalsByBranch = new Map<string, KioskTerminal[]>();
      terminals.forEach((terminal) => {
        const current = terminalsByBranch.get(terminal.branchId) ?? [];
        current.push(terminal);
        terminalsByBranch.set(terminal.branchId, current);
      });

      const countryMap = new Map<string, TreeNode>();
      const cityMap = new Map<string, TreeNode>();
      const districtMap = new Map<string, TreeNode>();

      countries.forEach((country) => {
        countryMap.set(country.id, {
          id: country.id,
          type: 'country',
          name: country.name,
          createdAt: country.createdAt,
          countryId: country.id,
          children: [],
          stats: emptyStats(),
          workplaces: [],
          terminals: [],
          serviceNames: [],
        });
      });

      cities.forEach((city) => {
        const node: TreeNode = {
          id: city.id,
          type: 'city',
          name: city.name,
          createdAt: city.createdAt,
          countryId: city.countryId,
          cityId: city.id,
          children: [],
          stats: emptyStats(),
          workplaces: [],
          terminals: [],
          serviceNames: [],
        };
        cityMap.set(city.id, node);
        countryMap.get(city.countryId)?.children.push(node);
      });

      districts.forEach((district) => {
        const parentCity = cityMap.get(district.cityId);
        if (!parentCity) {
          return;
        }

        const node: TreeNode = {
          id: district.id,
          type: 'district',
          name: district.name,
          createdAt: district.createdAt,
          countryId: parentCity.countryId,
          cityId: district.cityId,
          districtId: district.id,
          children: [],
          stats: emptyStats(),
          workplaces: [],
          terminals: [],
          serviceNames: [],
        };
        districtMap.set(district.id, node);
        parentCity.children.push(node);
      });

      branches.forEach((branch) => {
        const node: TreeNode = {
          id: branch.id,
          type: 'branch',
          name: branch.name,
          createdAt: branch.createdAt,
          countryId: branch.countryId,
          cityId: branch.cityId,
          districtId: branch.districtId,
          children: [],
          stats: emptyStats(),
          workplaces: workplacesByBranch.get(branch.id) ?? [],
          terminals: terminalsByBranch.get(branch.id) ?? [],
          serviceNames: [],
        };
        districtMap.get(branch.districtId)?.children.push(node);
      });

      setTree(Array.from(countryMap.values()).map(aggregateNode));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка при завантаженні структури');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAndBuildTree();
  }, [loadAndBuildTree]);

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((previous) => {
      const next = new Set(previous);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      nextErrors.name = 'Назва обов’язкова';
    }
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreateEntity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);

      if (createLevel === 'country') {
        await apiClient.createCountry({
          name: formData.name.trim(),
          code: formData.name.trim().slice(0, 2).toUpperCase(),
        });
      } else if (createLevel === 'city' && parentForCreate) {
        await apiClient.createCity({
          name: formData.name.trim(),
          countryId: parentForCreate.id,
        });
      } else if (createLevel === 'district' && parentForCreate) {
        await apiClient.createDistrict({
          name: formData.name.trim(),
          cityId: parentForCreate.id,
        });
      } else if (createLevel === 'branch' && parentForCreate) {
        await apiClient.createBranch({
          name: formData.name.trim(),
          countryId: parentForCreate.countryId,
          cityId: parentForCreate.cityId,
          districtId: parentForCreate.id,
        });
      }

      await loadAndBuildTree();
      if (parentForCreate) {
        setExpandedNodes((previous) => new Set(previous).add(parentForCreate.id));
      }
      closeModals();
    } catch (err) {
      setFormErrors({
        name: err instanceof Error ? err.message : 'Не вдалося створити елемент',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEntity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingEntity || !validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      await apiClient.updateOrgEntity(
        editingEntity.id,
        { name: formData.name.trim() },
        routeByType[editingEntity.type],
      );
      await loadAndBuildTree();
      closeModals();
    } catch (err) {
      setFormErrors({
        name: err instanceof Error ? err.message : 'Не вдалося оновити елемент',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntity = async () => {
    if (!deleteConfirmEntity) {
      return;
    }

    try {
      setIsDeleteLoading(true);
      await apiClient.deleteOrgEntity(deleteConfirmEntity.id, routeByType[deleteConfirmEntity.type]);
      await loadAndBuildTree();
      setDeleteConfirmEntity(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося видалити елемент');
    } finally {
      setIsDeleteLoading(false);
    }
  };

  const handleCopyApiKey = async (terminalId: string, apiKey: string) => {
    await navigator.clipboard.writeText(apiKey);
    setCopyStateId(terminalId);
    window.setTimeout(() => setCopyStateId(null), 1800);
  };

  const handleRotateTerminalKey = async (terminalId: string) => {
    try {
      setRotatingTerminalId(terminalId);
      await apiClient.rotateKioskTerminalKey(terminalId);
      await loadAndBuildTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося оновити ключ термінала');
    } finally {
      setRotatingTerminalId(null);
    }
  };

  const hasExpandableContent = (node: TreeNode) => node.type === 'branch' || node.children.length > 0;

  const renderSummaryPills = (node: TreeNode) => {
    const pills: Array<{ key: string; icon: typeof Globe; label: string; value: number }> = [];

    if (node.type === 'country') {
      pills.push({ key: 'cities', icon: MapPin, label: 'міст', value: node.stats.cities });
      pills.push({ key: 'districts', icon: Grid3x3, label: 'районів', value: node.stats.districts });
      pills.push({ key: 'branches', icon: Building2, label: 'філій', value: node.stats.branches });
    }

    if (node.type === 'city') {
      pills.push({ key: 'districts', icon: Grid3x3, label: 'районів', value: node.stats.districts });
      pills.push({ key: 'branches', icon: Building2, label: 'філій', value: node.stats.branches });
    }

    if (node.type === 'district') {
      pills.push({ key: 'branches', icon: Building2, label: 'філій', value: node.stats.branches });
      pills.push({ key: 'workplaces', icon: Workflow, label: 'робочих місць', value: node.stats.workplaces });
      pills.push({ key: 'services', icon: ClipboardList, label: 'послуг', value: node.stats.services });
      pills.push({ key: 'terminals', icon: MonitorSmartphone, label: 'терміналів', value: node.stats.terminals });
    }

    if (node.type === 'branch') {
      pills.push({ key: 'workplaces', icon: Workflow, label: 'робочих місць', value: node.stats.workplaces });
      pills.push({ key: 'services', icon: ClipboardList, label: 'послуг', value: node.stats.services });
      pills.push({ key: 'terminals', icon: MonitorSmartphone, label: 'терміналів', value: node.stats.terminals });
    }

    return (
      <div className="flex flex-wrap gap-2">
        {pills.map((pill) => {
          const PillIcon = pill.icon;
          return (
            <span key={pill.key} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
              <PillIcon size={12} />
              <span>{pill.value} {pill.label}</span>
            </span>
          );
        })}
      </div>
    );
  };

  const renderNodeActions = (node: TreeNode) => (
    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
      <button
        onClick={() => openEditModal(node)}
        className="rounded p-1.5 text-blue-600 transition hover:bg-blue-50"
        title="Редагувати"
      >
        <Edit2 size={15} />
      </button>
      {node.type !== 'branch' && (
        <button
          onClick={() => openCreateModal(node.type === 'country' ? 'city' : node.type === 'city' ? 'district' : 'branch', node)}
          className="rounded p-1.5 text-green-600 transition hover:bg-green-50"
          title={`Додати ${node.type === 'country' ? 'місто' : node.type === 'city' ? 'район' : 'філію'}`}
        >
          <Plus size={15} />
        </button>
      )}
      <button
        onClick={() => setDeleteConfirmEntity(node)}
        className="rounded p-1.5 text-red-600 transition hover:bg-red-50"
        title="Видалити"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );

  const renderBranchDetails = (branch: TreeNode) => (
    <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">Робочі місця</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{branch.stats.workplaces}</div>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">Послуги філії</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{branch.stats.services}</div>
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">Термінали</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{branch.stats.terminals}</div>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <ClipboardList size={16} />
          Послуги, що реально доступні у філії
        </div>
        {branch.serviceNames.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {branch.serviceNames.map((serviceName) => (
              <span key={serviceName} className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">
                {serviceName}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Послуги ще не прив’язані до робочих місць цієї філії.</p>
        )}
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <MonitorSmartphone size={16} />
          Ключі терміналів цієї філії
        </div>
        {branch.terminals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 text-left font-semibold">Термінал</th>
                  <th className="px-3 py-2 text-left font-semibold">Ключ</th>
                  <th className="px-3 py-2 text-left font-semibold">Статус</th>
                  <th className="px-3 py-2 text-left font-semibold">Оновлено</th>
                  <th className="px-3 py-2 text-left font-semibold">Дії</th>
                </tr>
              </thead>
              <tbody>
                {branch.terminals.map((terminal) => (
                  <tr key={terminal.id} className="border-b border-gray-50 last:border-b-0">
                    <td className="px-3 py-3 font-medium text-gray-900">{terminal.name}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <code className="max-w-[320px] truncate rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">{terminal.apiKey}</code>
                        <button
                          onClick={() => void handleCopyApiKey(terminal.id, terminal.apiKey)}
                          className="rounded p-1 text-gray-500 transition hover:bg-gray-100"
                          title="Копіювати ключ"
                        >
                          <Copy size={14} />
                        </button>
                        {copyStateId === terminal.id && <span className="text-xs text-green-600">Скопійовано</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs ${terminal.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {terminal.status === 'ACTIVE' ? 'Активний' : 'Неактивний'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">{formatDateTime(terminal.updatedAt)}</td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => void handleRotateTerminalKey(terminal.id)}
                        className="rounded p-1.5 text-purple-600 transition hover:bg-purple-50 disabled:opacity-50"
                        title="Перегенерувати ключ"
                        disabled={rotatingTerminalId === terminal.id}
                      >
                        <RotateCw size={14} className={rotatingTerminalId === terminal.id ? 'animate-spin' : ''} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Для цієї філії ще не створено терміналів, тому й ключів тут поки немає.</p>
        )}
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Workflow size={16} />
          Робочі місця і їхні послуги
        </div>
        {branch.workplaces.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2 text-left font-semibold">Робоче місце</th>
                  <th className="px-3 py-2 text-left font-semibold">Послуга</th>
                  <th className="px-3 py-2 text-left font-semibold">Статус</th>
                </tr>
              </thead>
              <tbody>
                {branch.workplaces.map((workplace) => (
                  <tr key={workplace.id} className="border-b border-gray-50 last:border-b-0">
                    <td className="px-3 py-3 font-medium text-gray-900">{workplace.number}</td>
                    <td className="px-3 py-3 text-gray-700">{workplace.serviceName || 'Не призначено'}</td>
                    <td className="px-3 py-3 text-gray-700">{workplace.isActive ? 'Активне' : 'Неактивне'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">У філії ще немає робочих місць. Через це послуги для неї фактично не налаштовані.</p>
        )}
      </div>
    </div>
  );

  const renderChildTable = (node: TreeNode, level: number) => {
    const childType = node.children[0]?.type;

    if (!childType) {
      return null;
    }

    const columns =
      childType === 'city'
        ? ['name', 'districts', 'branches', 'services', 'createdAt', 'actions']
        : childType === 'district'
          ? ['name', 'branches', 'workplaces', 'services', 'terminals', 'createdAt', 'actions']
          : ['name', 'workplaces', 'services', 'terminals', 'createdAt', 'actions'];

    const renderCell = (child: TreeNode, column: string) => {
      if (column === 'name') {
        const ChildIcon = iconByType[child.type];
        return (
          <div className="flex items-center gap-2">
            {hasExpandableContent(child) ? (
              <button
                onClick={() => toggleNode(child.id)}
                className="rounded p-0.5 text-gray-500 transition hover:bg-gray-100"
                title={expandedNodes.has(child.id) ? 'Згорнути' : 'Розгорнути'}
              >
                {expandedNodes.has(child.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="w-[18px]" />
            )}
            <ChildIcon size={15} className="text-gray-500" />
            <span className="font-medium text-gray-900">{child.name}</span>
          </div>
        );
      }

      if (column === 'districts') {
        return <span className="text-gray-700">{child.stats.districts}</span>;
      }

      if (column === 'branches') {
        return <span className="text-gray-700">{child.stats.branches}</span>;
      }

      if (column === 'workplaces') {
        return <span className="text-gray-700">{child.stats.workplaces}</span>;
      }

      if (column === 'services') {
        return (
          <div className="flex items-center gap-2">
            <span className="text-gray-700">{child.stats.services}</span>
            {child.serviceNames.length > 0 && (
              <span className="hidden truncate text-xs text-gray-500 md:inline">
                {child.serviceNames.slice(0, 2).join(', ')}{child.serviceNames.length > 2 ? '...' : ''}
              </span>
            )}
          </div>
        );
      }

      if (column === 'terminals') {
        return <span className="text-gray-700">{child.stats.terminals}</span>;
      }

      if (column === 'createdAt') {
        return <span className="text-xs text-gray-500">{formatDateTime(new Date(child.createdAt))}</span>;
      }

      return renderNodeActions(child);
    };

    return (
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 text-left font-semibold">
                  {column === 'name' && 'Назва'}
                  {column === 'districts' && 'Райони'}
                  {column === 'branches' && 'Філії'}
                  {column === 'workplaces' && 'Робочі місця'}
                  {column === 'services' && 'Послуги'}
                  {column === 'terminals' && 'Термінали'}
                  {column === 'createdAt' && 'Створено'}
                  {column === 'actions' && 'Дії'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {node.children.map((child) => (
              <FragmentRow
                key={child.id}
                child={child}
                columns={columns}
                expanded={expandedNodes.has(child.id)}
                renderCell={renderCell}
                renderExpanded={() => renderNodeBody(child, level + 1)}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderNodeBody = (node: TreeNode, level: number) => {
    if (node.type === 'branch') {
      return renderBranchDetails(node);
    }

    if (node.children.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
          Для цього вузла ще немає дочірніх елементів.
        </div>
      );
    }

    return renderChildTable(node, level);
  };

  const renderRootNode = (node: TreeNode) => {
    const NodeIcon = iconByType[node.type];
    const expanded = expandedNodes.has(node.id);

    return (
      <section key={node.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="group flex items-start gap-3 px-5 py-4">
          <button
            onClick={() => toggleNode(node.id)}
            className="mt-0.5 rounded p-1 text-gray-500 transition hover:bg-gray-100"
            title={expanded ? 'Згорнути' : 'Розгорнути'}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <div className="mt-1 rounded-lg bg-gray-100 p-2 text-gray-600">
            <NodeIcon size={18} />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">{node.name}</h2>
              <span className="text-xs text-gray-500">{labelByType[node.type]}</span>
              <span className="text-xs text-gray-500">Створено: {formatDateTime(new Date(node.createdAt))}</span>
            </div>
            {renderSummaryPills(node)}
          </div>
          <div className="shrink-0">{renderNodeActions(node)}</div>
        </div>

        {expanded && (
          <div className="border-t border-gray-100 bg-white px-5 py-4">
            {renderNodeBody(node, 0)}
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      <Head>
        <title>Організаційна структура - SoftTurn</title>
      </Head>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Організаційна структура</h1>
            <p className="mt-2 max-w-3xl text-gray-600">
              Тут має бути не просто дерево, а зона відповідальності: хто під ким, скільки філій у районі, які послуги реально доступні і які ключі терміналів уже видані по філіях.
            </p>
          </div>
          <button onClick={() => openCreateModal('country')} className="btn btn-primary inline-flex items-center gap-2">
            <Plus size={18} />
            Нова країна
          </button>
        </div>

        {error && (
          <div className="alert alert-error">
            <p>{error}</p>
            <button onClick={() => void loadAndBuildTree()} className="mt-2 text-sm underline hover:no-underline">
              Спробувати ще раз
            </button>
          </div>
        )}

        {loading ? (
          <div className="card flex items-center justify-center py-12">
            <div className="spinner" />
            <span className="ml-3 text-gray-600">Завантаження структури...</span>
          </div>
        ) : tree.length === 0 ? (
          <div className="card py-16 text-center">
            <Globe size={44} className="mx-auto text-gray-400" />
            <p className="mt-4 text-gray-500">Структура ще порожня</p>
          </div>
        ) : (
          <div className="space-y-4">{tree.map(renderRootNode)}</div>
        )}
      </div>

      <Modal
        isOpen={isCreateModalOpen || isEditModalOpen}
        onClose={closeModals}
        title={
          editingEntity
            ? `Редагувати: ${editingEntity.name}`
            : parentForCreate
              ? `Додати ${labelByType[createLevel].toLowerCase()} до «${parentForCreate.name}»`
              : 'Створити країну'
        }
        size="md"
      >
        <form onSubmit={editingEntity ? handleUpdateEntity : handleCreateEntity} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Назва</label>
            <input
              type="text"
              className={`form-input ${formErrors.name ? 'border-red-500' : ''}`}
              value={formData.name}
              onChange={(event) => setFormData({ name: event.target.value })}
              disabled={isSubmitting}
              autoFocus
            />
            {formErrors.name && <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModals} className="btn btn-white" disabled={isSubmitting}>
              Скасувати
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Зберігаю...' : editingEntity ? 'Оновити' : 'Створити'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirmEntity}
        title="Видалити елемент"
        message={`Ви дійсно хочете видалити «${deleteConfirmEntity?.name}»?`}
        onConfirm={handleDeleteEntity}
        onCancel={() => setDeleteConfirmEntity(null)}
        isDangerous
        isLoading={isDeleteLoading}
      />
    </>
  );
}

export default withDashboard(OrgStructurePage);
