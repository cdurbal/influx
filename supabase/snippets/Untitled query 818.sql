update leads.sync_settings set value = '{"advertisers": 11, "creators": 12}' where key = 'brevo_list_ids';
update leads.sync_settings set value = '{"account.welcome_advertiser": 21, "account.welcome_creator": 22}' where key = 'brevo_template_ids';
update leads.sync_settings set value = '["GB"]' where key = 'apollo_prospecting_countries';
