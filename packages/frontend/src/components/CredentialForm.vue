<template>
  <a-form layout="vertical">
    <a-form-item
      v-for="field in fields"
      :key="field.key"
      :label="field.label"
      :required="field.required"
    >
      <a-input-password
        v-if="field.type === 'password'"
        :value="modelValue[field.key] ?? ''"
        :placeholder="field.placeholder ?? `请输入 ${field.label}`"
        @update:value="(value) => handleUpdate(field.key, value ?? '')"
      />
      <a-input
        v-else
        :value="modelValue[field.key] ?? ''"
        :placeholder="field.placeholder ?? `请输入 ${field.label}`"
        :prefix="field.type === 'url' ? 'URL' : undefined"
        @update:value="(value) => handleUpdate(field.key, value ?? '')"
      />
      <div v-if="field.description" class="field-desc">{{ field.description }}</div>
    </a-form-item>
  </a-form>
</template>

<script setup lang="ts">
  import type { CredentialField } from '@sga/shared';

  const props = defineProps<{
    fields: CredentialField[];
    modelValue: Record<string, string>;
  }>();

  const emit = defineEmits<{
    (event: 'update:modelValue', value: Record<string, string>): void;
  }>();

  const handleUpdate = (key: string, value: string): void => {
    emit('update:modelValue', { ...props.modelValue, [key]: value });
  };
</script>

<style scoped>
  .field-desc {
    margin-top: 4px;
    color: #8c8c8c;
    font-size: 12px;
    line-height: 1.4;
  }
</style>
