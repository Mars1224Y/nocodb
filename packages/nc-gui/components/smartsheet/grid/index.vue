<script lang="ts" setup>
import type { ColumnType, GridType } from 'nocodb-sdk'
import Table from './Table.vue'
import GroupBy from './GroupBy.vue'

const meta = inject(MetaInj, ref())

const view = inject(ActiveViewInj, ref())

const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())

// keep a root fields variable and will get modified from
// fields menu and get used in grid and gallery
const _fields = inject(FieldsInj, ref([]))

const router = useRouter()

const route = router.currentRoute

const { xWhere, eventBus } = useSmartsheetStoreOrThrow()

const { t } = useI18n()

const bulkUpdateDlg = ref(false)

const routeQuery = computed(() => route.value.query as Record<string, string>)

const expandedFormDlg = ref(false)
const expandedFormRow = ref<Row>()
const expandedFormRowState = ref<Record<string, any>>()

const tableRef = ref<typeof Table>()

const {
  loadData,
  paginationData,
  formattedData: data,
  updateOrSaveRow,
  changePage,
  addEmptyRow: _addEmptyRow,
  deleteRow,
  deleteSelectedRows,
  selectedAllRecords,
  removeRowIfNew,
  navigateToSiblingRow,
  getExpandedRowIndex,
  deleteRangeOfRows,
  bulkUpdateRows,
  bulkUpdateView,
  optimisedQuery,
  islastRow,
  isFirstRow,
} = useViewData(meta, view, xWhere)

const rowHeight = computed(() => {
  if ((view.value?.view as GridType)?.row_height !== undefined) {
    switch ((view.value?.view as GridType)?.row_height) {
      case 0:
        return 1
      case 1:
        return 2
      case 2:
        return 4
      case 3:
        return 6
      default:
        return 1
    }
  }
})

provide(IsFormInj, ref(false))

provide(IsGalleryInj, ref(false))

provide(IsGridInj, ref(true))

provide(IsCalendarInj, ref(false))

provide(RowHeightInj, rowHeight)

const isPublic = inject(IsPublicInj, ref(false))

// reload table data reload hook as fallback to rowdatareload
provide(ReloadRowDataHookInj, reloadViewDataHook)

const skipRowRemovalOnCancel = ref(false)

function expandForm(row: Row, state?: Record<string, any>, fromToolbar = false) {
  const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
  expandedFormRowState.value = state
  if (rowId && !isPublic.value) {
    router.push({
      query: {
        ...routeQuery.value,
        rowId,
      },
    })
  } else {
    expandedFormRow.value = row
    expandedFormDlg.value = true
    skipRowRemovalOnCancel.value = !fromToolbar
  }
}

const exposeOpenColumnCreate = (data: any) => {
  tableRef.value?.openColumnCreate(data)
}

defineExpose({
  loadData,
  openColumnCreate: exposeOpenColumnCreate,
})

const expandedFormOnRowIdDlg = computed({
  get() {
    return !!routeQuery.value.rowId
  },
  set(val) {
    if (!val)
      router.push({
        query: {
          ...routeQuery.value,
          rowId: undefined,
        },
      })
  },
})

const addRowExpandOnClose = (row: Row) => {
  if (!skipRowRemovalOnCancel.value) {
    eventBus.emit(SmartsheetStoreEvents.CLEAR_NEW_ROW, row)
  }
}

const toggleOptimisedQuery = () => {
  if (optimisedQuery.value) {
    optimisedQuery.value = false
    message.info(t('msg.optimizedQueryDisabled'))
  } else {
    optimisedQuery.value = true
    message.info(t('msg.optimizedQueryEnabled'))
  }
}

const { rootGroup, groupBy, isGroupBy, loadGroups, loadGroupData, loadGroupPage, groupWrapperChangePage, redistributeRows } =
  useViewGroupByOrThrow()

const sidebarStore = useSidebarStore()

const { windowSize, leftSidebarWidth } = toRefs(sidebarStore)

const viewWidth = ref(0)

eventBus.on((event) => {
  if (event === SmartsheetStoreEvents.GROUP_BY_RELOAD || event === SmartsheetStoreEvents.DATA_RELOAD) {
    reloadViewDataHook?.trigger()
  }
})

const goToNextRow = () => {
  const currentIndex = getExpandedRowIndex()
  /* when last index of current page is reached we should move to next page */
  if (!paginationData.value.isLastPage && currentIndex === paginationData.value.pageSize) {
    const nextPage = paginationData.value?.page ? paginationData.value?.page + 1 : 1
    changePage(nextPage)
  }

  navigateToSiblingRow(NavigateDir.NEXT)
}

const goToPreviousRow = () => {
  const currentIndex = getExpandedRowIndex()
  /* when first index of current page is reached and then clicked back 
    previos page should be loaded
  */
  if (!paginationData.value.isFirstPage && currentIndex === 1) {
    const nextPage = paginationData.value?.page ? paginationData.value?.page - 1 : 1
    changePage(nextPage)
  }

  navigateToSiblingRow(NavigateDir.PREV)
}

const updateViewWidth = () => {
  if (isPublic.value) {
    viewWidth.value = windowSize.value
    return
  }
  viewWidth.value = windowSize.value - leftSidebarWidth.value
}

const baseColor = computed(() => {
  switch (groupBy.value.length) {
    case 1:
      return '#F9F9FA'
    case 2:
      return '#F4F4F5'
    case 3:
      return '#E7E7E9'
    default:
      return '#F9F9FA'
  }
})

watch([windowSize, leftSidebarWidth], updateViewWidth)

onMounted(() => {
  updateViewWidth()
})
</script>

<template>
  <div
    class="relative flex flex-col h-full min-h-0 w-full nc-grid-wrapper"
    data-testid="nc-grid-wrapper"
    :style="`width: ${viewWidth}px; background-color: ${isGroupBy ? `${baseColor}` : 'var(--nc-grid-bg)'};`"
  >
    <Table
      v-if="!isGroupBy"
      ref="tableRef"
      v-model:selected-all-records="selectedAllRecords"
      :data="data"
      :pagination-data="paginationData"
      :load-data="loadData"
      :change-page="changePage"
      :call-add-empty-row="_addEmptyRow"
      :delete-row="deleteRow"
      :update-or-save-row="updateOrSaveRow"
      :delete-selected-rows="deleteSelectedRows"
      :delete-range-of-rows="deleteRangeOfRows"
      :bulk-update-rows="bulkUpdateRows"
      :remove-row-if-new="removeRowIfNew"
      :expand-form="expandForm"
      :row-height="rowHeight"
      @toggle-optimised-query="toggleOptimisedQuery"
      @bulk-update-dlg="bulkUpdateDlg = true"
    />

    <GroupBy
      v-else
      :group="rootGroup"
      :load-groups="loadGroups"
      :load-group-data="loadGroupData"
      :load-group-page="loadGroupPage"
      :group-wrapper-change-page="groupWrapperChangePage"
      :row-height="rowHeight"
      :max-depth="groupBy.length"
      :redistribute-rows="redistributeRows"
      :expand-form="expandForm"
      :view-width="viewWidth"
    />
    <Suspense>
      <LazySmartsheetExpandedForm
        v-if="expandedFormRow && expandedFormDlg"
        v-model="expandedFormDlg"
        :load-row="!isPublic"
        :row="expandedFormRow"
        :state="expandedFormRowState"
        :meta="meta"
        :view="view"
        @update:model-value="addRowExpandOnClose(expandedFormRow)"
      />
    </Suspense>
    <SmartsheetExpandedForm
      v-if="expandedFormOnRowIdDlg && meta?.id"
      v-model="expandedFormOnRowIdDlg"
      :row="expandedFormRow ?? { row: {}, oldRow: {}, rowMeta: {} }"
      :meta="meta"
      :load-row="!isPublic"
      :state="expandedFormRowState"
      :row-id="routeQuery.rowId"
      :view="view"
      show-next-prev-icons
      :first-row="isFirstRow"
      :last-row="islastRow"
      :expand-form="expandForm"
      @next="goToNextRow()"
      @prev="goToPreviousRow()"
    />

    <Suspense>
      <LazyDlgBulkUpdate
        v-if="bulkUpdateDlg"
        v-model="bulkUpdateDlg"
        :pagination-data="paginationData"
        :meta="meta"
        :view="view"
        :bulk-update-rows="bulkUpdateRows"
        :bulk-update-view="bulkUpdateView"
        :selected-all-records="selectedAllRecords"
        :rows="data.filter((r) => r.rowMeta.selected)"
      />
    </Suspense>
  </div>
</template>

<style lang="scss">
.nc-grid-pagination-wrapper .ant-dropdown-button {
  > .ant-btn {
    @apply !p-0 !rounded-l-lg hover:border-gray-300;
  }

  > .ant-dropdown-trigger {
    @apply !rounded-r-lg;
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  @apply !rounded-lg;
}
</style>
