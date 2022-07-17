<script setup lang="ts">
import { computed } from 'vue';
import { TokenValue } from 'everscale-inpage-provider';

import { Structure } from '../common';

const props = defineProps<{
  structure: Structure;
  customName?: string;
  value: TokenValue<string>;
  removable?: boolean;
}>();

const emit = defineEmits<{
  (e: 'change', value: TokenValue<string>): void;
  (e: 'removed'): void;
}>();

const name = computed(() => props.customName || props.structure.name);
const title = computed(() => (name.value.length > 0 ? `${name.value}: ${props.structure.type}` : props.structure.type));

type MapEntry = [TokenValue<string>, TokenValue<string>];

function ensureMapParam(structure: Structure, value: TokenValue<string>): asserts value is MapEntry[] {
  if (structure.fieldType !== 'map') {
    throw new Error('Invalid value');
  }
}

function findEntryByKey(key: TokenValue<string>): readonly [MapEntry | undefined, number] {
  ensureMapParam(props.structure, props.value);
  const index = props.value.findIndex(([entryKey]) => entryKey == key);
  const entry = props.value[index];
  return [entry, index];
}

function onInput(event: InputEvent) {
  const value = (event.target as HTMLInputElement).value;
  emit('change', value);
}

function onChangeTupleValue(name: string, value: TokenValue<string>) {
  (props.value as { [name: string]: TokenValue<string> })[name] = value;
}

function onChangeMapKey(oldKey: TokenValue<string>, newKey: TokenValue<string>) {
  const [entry] = findEntryByKey(oldKey);
  if (entry == null) return console.warn('Old key not found');
  entry[0] = newKey;
}

function onChangeMapValue(key: TokenValue<string>, value: TokenValue<string>) {
  const [entry] = findEntryByKey(key);
  if (entry == null) return console.warn('Old key not found');
  entry[1] = value;
}

function onDeleteMapEntry(key: TokenValue<string>) {
  const [, index] = findEntryByKey(key);
  (props.value as MapEntry[]).splice(index, 1);
}

function onAddMapEntry() {
  const key = JSON.parse(JSON.stringify(props.structure.key.defaultValue));
  const value = JSON.parse(JSON.stringify(props.structure.value.defaultValue));
  (props.value as MapEntry[]).push([key, value]);
}

function onChangeArrayElement(i: number, value: TokenValue<string>) {
  (props.value as TokenValue<string>[])[i] = value;
}

function onAddArrayElement() {
  const value = JSON.parse(JSON.stringify(props.structure.value.defaultValue));
  (props.value as TokenValue<string>[]).push(value);
}

function onDeleteArrayElement(i: number) {
  (props.value as TokenValue<string>[]).splice(i, 1);
}

function onOptionalChange() {
  emit('change', props.value == null ? props.structure.defaultValue : null);
}
</script>

<template>
  <div class="field box p-3">
    <div v-if="structure.optional === true" class="tags has-addons mb-0">
      <span class="tag mb-0">{{ title }}</span>
      <label class="tag mb-0 checkbox">
        <input type="checkbox" :checked="value != null" @change="onOptionalChange" />
      </label>
    </div>
    <div v-else-if="removable" class="tags has-addons mb-0">
      <span class="tag mb-0">{{ title }}</span>
      <a class="tag is-delete mb-0" @click="emit('removed')" />
    </div>
    <span v-else :class="['tag', { 'mb-3': structure.fieldType === 'tuple' }]">{{ title }}</span>

    <template v-if="value != null">
      <div v-if="structure.fieldType === 'checkbox'" class="control is-unselectable">
        <label class="checkbox">
          <input type="checkbox" :checked="value" @change="emit('change', !value)" />
        </label>
      </div>
      <div v-else-if="structure.fieldType === 'number'">
        <div class="control">
          <input class="input is-small" spellcheck="false" type="text" :value="value" @input="onInput" />
        </div>
      </div>
      <div v-else-if="structure.fieldType === 'text'">
        <div class="control">
          <textarea class="textarea is-small" rows="2" spellcheck="false" :value="value" @input="onInput" />
        </div>
      </div>
      <template v-else-if="structure.fieldType === 'tuple'">
        <EntityBuilderItem
          v-for="(item, i) in structure.components"
          :key="i"
          :structure="item"
          :value="value[item.name]"
          @change="onChangeTupleValue(item.name, $event)"
        />
      </template>
      <template v-else-if="structure.fieldType === 'array'">
        <EntityBuilderItem
          v-for="(item, i) in value"
          :key="i"
          :structure="structure.value"
          removable
          :custom-name="`${name}[${i}]`"
          :value="item"
          @change="onChangeArrayElement(i, $event)"
          @removed="onDeleteArrayElement(i)"
        />
        <button class="button is-fullwidth is-small" @click="onAddArrayElement()">Add element</button>
      </template>
      <template v-else-if="structure.fieldType === 'map'">
        <div v-for="(item, i) in value" :key="i" class="is-flex is-flex-direction-row">
          <EntityBuilderItem
            class="is-flex-grow-1 is-key"
            :structure="structure.key"
            removable
            custom-name="Entry key"
            :value="item[0]"
            @change="onChangeMapKey(item[0], $event)"
            @removed="onDeleteMapEntry(item[0])"
          />
          <EntityBuilderItem
            class="is-flex-grow-5 is-value mb-3 ml-1"
            :structure="structure.value"
            custom-name="Entry value"
            :value="item[1]"
            @change="onChangeMapValue(item[0], $event)"
          />
        </div>
        <button class="button is-fullwidth is-small" @click="onAddMapEntry()">Add entry</button>
      </template>
    </template>
  </div>
</template>

<style lang="scss">
@import '../styles/constants';

.wide {
  width: 100%;
}

.field {
  &.is-key {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  &.is-value {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
}
</style>
