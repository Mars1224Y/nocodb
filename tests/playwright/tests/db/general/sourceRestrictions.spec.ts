import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';
import { Api } from 'nocodb-sdk';
import { SettingsPage } from '../../../pages/Dashboard/Settings';

test.describe('Source Restrictions', () => {
  let dashboard: DashboardPage;
  let settingsPage: SettingsPage;
  let context: NcContext;
  let api: Api<any>;
  test.setTimeout(150000);

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(70000);
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.base);
    settingsPage = new SettingsPage(dashboard);
    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Readonly data source', async () => {
    await dashboard.treeView.openProjectSourceSettings({ title: context.base.title, context });

    await settingsPage.selectTab({ tab: 'dataSources' });
    await dashboard.rootPage.waitForTimeout(300);

    await settingsPage.source.updateSchemaReadOnly({ sourceName: 'Default', readOnly: true });
    await settingsPage.source.updateDataReadOnly({ sourceName: 'Default', readOnly: true });
    await settingsPage.close();

    // reload page to reflect source changes
    await dashboard.rootPage.reload();

    await dashboard.treeView.verifyTable({ title: 'Actor' });

    // open table and verify that it is readonly
    await dashboard.treeView.openTable({ title: 'Actor' });
    await expect(dashboard.grid.get().locator('.nc-grid-add-new-cell')).toHaveCount(0);

    await dashboard.grid.get().getByTestId(`cell-FirstName-0`).click({
      button: 'right',
    });

    await expect(dashboard.rootPage.locator('.ant-dropdown-menu-item:has-text("Copy")')).toHaveCount(1);
    await expect(dashboard.rootPage.locator('.ant-dropdown-menu-item:has-text("Delete record")')).toHaveCount(0);
  });

  test('Readonly schema source', async () => {
    await dashboard.treeView.openProjectSourceSettings({ title: context.base.title, context });

    await settingsPage.selectTab({ tab: 'dataSources' });
    await dashboard.rootPage.waitForTimeout(300);

    await settingsPage.source.updateSchemaReadOnly({ sourceName: 'Default', readOnly: true });
    await settingsPage.close();

    // reload page to reflect source changes
    await dashboard.rootPage.reload();

    await dashboard.treeView.verifyTable({ title: 'Actor' });

    // open table and verify that it is readonly
    await dashboard.treeView.openTable({ title: 'Actor' });

    await dashboard.grid
      .get()
      .locator(`th[data-title="LastName"]`)
      .first()
      .locator('.nc-ui-dt-dropdown')
      .scrollIntoViewIfNeeded();
    await dashboard.grid.get().locator(`th[data-title="LastName"]`).first().locator('.nc-ui-dt-dropdown').click();
    for (const item of ['Edit', 'Delete', 'Duplicate']) {
      await expect(
        await dashboard.rootPage.locator(`li[role="menuitem"]:has-text("${item}"):visible`).last()
      ).toBeVisible();
      await expect(
        await dashboard.rootPage.locator(`li[role="menuitem"]:has-text("${item}"):visible`).last()
      ).toHaveClass(/ant-dropdown-menu-item-disabled/);
    }
  });
});
