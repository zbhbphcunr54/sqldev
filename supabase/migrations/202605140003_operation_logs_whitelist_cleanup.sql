update public.operation_logs
set operation = 'sql_convert'
where operation = 'sql-convert';

delete from public.operation_logs
where operation not in (
  'sql_convert',
  'id_card_generate',
  'id_card_validate',
  'uscc_generate',
  'uscc_validate',
  'ziwei_chart_generate',
  'ziwei_analysis',
  'ziwei_qa',
  'ai_provider_create',
  'ai_provider_update',
  'ai_provider_delete',
  'ai_config_create',
  'ai_config_append_model',
  'ai_config_test',
  'ai_config_delete',
  'ai_chat_message'
);
