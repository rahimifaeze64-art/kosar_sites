/**
 * jalali-picker.js
 *
 * Thin adapter around @majidh1/jalalidatepicker for a static/vanilla-JS site.
 *
 * Requirements:
 *   - jalalidatepicker.min.css
 *   - jalalidatepicker.min.js
 *   must be loaded BEFORE this file.
 *
 * Public API:
 *   JalaliPicker.init()
 *   JalaliPicker.attachById(id)
 *   JalaliPicker.sync(id)
 *   JalaliPicker.start()
 */

(function (root) {
    'use strict';

    var LIBRARY_SELECTOR = 'input[data-jdp]';
    var LEGACY_SELECTOR = 'input[data-jalali]';

    var DISPLAY_ATTRIBUTE = 'data-jalali-display';
    var TARGET_ATTRIBUTE = 'data-jdp-target-value-input';
    var TARGET_TYPE_ATTRIBUTE = 'data-jdp-target-value-type';

    var initialized = false;

    function logError(message) {
        if (root.console && console.error) {
            console.error('[JalaliPicker] ' + message);
        }
    }

    function isLibraryReady() {
        return !!(
            root.jalaliDatepicker &&
            typeof root.jalaliDatepicker.startWatch === 'function'
        );
    }

    /**
     * Convert Gregorian YYYY-MM-DD to Jalali YYYY/MM/DD
     * for displaying an existing value.
     *
     * This does not use another date library.
     */
    function gregorianToJalaliDisplay(value) {
        if (!value) {
            return '';
        }

        var match = String(value).match(
            /^(\d{4})-(\d{1,2})-(\d{1,2})/
        );

        if (!match) {
            return '';
        }

        var year = Number(match[1]);
        var month = Number(match[2]);
        var day = Number(match[3]);

        var date = new Date(
            Date.UTC(
                year,
                month - 1,
                day,
                12,
                0,
                0
            )
        );

        if (isNaN(date.getTime())) {
            return '';
        }

        try {
            var formatter = new Intl.DateTimeFormat(
                'en-US-u-ca-persian',
                {
                    calendar: 'persian',
                    numberingSystem: 'latn',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    timeZone: 'UTC'
                }
            );

            var parts = formatter.formatToParts(date);
            var result = {};

            parts.forEach(function (part) {
                if (part.type === 'year') {
                    result.year = part.value;
                }

                if (part.type === 'month') {
                    result.month = part.value;
                }

                if (part.type === 'day') {
                    result.day = part.value;
                }
            });

            if (
                !result.year ||
                !result.month ||
                !result.day
            ) {
                return '';
            }

            return (
                result.year +
                '/' +
                result.month +
                '/' +
                result.day
            );
        } catch (error) {
            logError(
                'Unable to convert the existing Gregorian date to Jalali.'
            );

            return '';
        }
    }

    /**
     * Copy visual/form-related attributes from the original input
     * to the visible Jalali input.
     */
    function copyInputAttributes(source, target) {

        if (source.className) {
            target.className = source.className;
        }

        if (source.getAttribute('style')) {
            target.setAttribute(
                'style',
                source.getAttribute('style')
            );
        }

        if (source.getAttribute('placeholder')) {
            target.setAttribute(
                'placeholder',
                source.getAttribute('placeholder')
            );
        } else {
            target.setAttribute(
                'placeholder',
                'انتخاب تاریخ'
            );
        }

        if (source.getAttribute('dir')) {
            target.setAttribute(
                'dir',
                source.getAttribute('dir')
            );
        }

        if (source.getAttribute('title')) {
            target.setAttribute(
                'title',
                source.getAttribute('title')
            );
        }

        if (source.getAttribute('aria-label')) {
            target.setAttribute(
                'aria-label',
                source.getAttribute('aria-label')
            );
        }

        if (source.disabled) {
            target.disabled = true;
        }

        if (source.required) {
            target.required = true;
        }

        target.readOnly = true;
        target.autocomplete = 'off';
    }

    /**
     * Create the visible Jalali input next to the original input.
     *
     * Original input:
     *   - remains the backend value
     *   - contains Gregorian date
     *
     * Display input:
     *   - visible to user
     *   - contains Jalali date
     *   - is controlled by JalaliDatePicker
     */
    function createDisplayInput(source) {

        var existing = source.nextElementSibling;

        if (
            existing &&
            existing.matches &&
            existing.matches(
                'input[' + DISPLAY_ATTRIBUTE + ']'
            )
        ) {
            return existing;
        }

        var display = document.createElement('input');

        display.type = 'text';

        display.setAttribute(
            DISPLAY_ATTRIBUTE,
            'true'
        );

        display.setAttribute(
            'data-jdp',
            ''
        );

        display.setAttribute(
            TARGET_ATTRIBUTE,
            '#' + source.id
        );

        display.setAttribute(
            TARGET_TYPE_ATTRIBUTE,
            'gregorian'
        );

        copyInputAttributes(
            source,
            display
        );

        /*
         * The display input must not be submitted
         * as a separate form field.
         */
        display.removeAttribute('name');

        display.removeAttribute('value');

        display.value =
            gregorianToJalaliDisplay(
                source.value
            );

        /*
         * Keep the original input in the form,
         * but hide it visually.
         */
        source.style.display = 'none';

        source.parentNode.insertBefore(
            display,
            source.nextSibling
        );

        return display;
    }

    function ensureId(input) {

        if (input.id) {
            return input.id;
        }

        var id =
            'jalali-date-' +
            Math.random()
                .toString(36)
                .slice(2, 10);

        input.id = id;

        return id;
    }

    /**
     * Convert an existing legacy input:
     *
     * <input
     *     id="order-date"
     *     name="orderDate"
     *     data-jalali
     * >
     *
     * into:
     *
     * Original input
     *     -> Gregorian/backend value
     *
     * Display input
     *     -> Jalali picker
     */
    function attach(input) {

        if (
            !input ||
            input.nodeType !== 1
        ) {
            return null;
        }

        /*
         * Never process the generated display input.
         */
        if (
            input.hasAttribute(
                DISPLAY_ATTRIBUTE
            )
        ) {
            return input;
        }

        /*
         * Prevent duplicate initialization.
         */
        if (
            input.dataset.jalaliPickerInitialized ===
            'true'
        ) {
            return (
                input.nextElementSibling ||
                input
            );
        }

        ensureId(input);

        var display =
            createDisplayInput(input);

        input.dataset.jalaliPickerInitialized =
            'true';

        /*
         * If the original input already contains
         * a Gregorian value, show the corresponding
         * Jalali value.
         */
        if (
            input.value &&
            !display.value
        ) {
            display.value =
                gregorianToJalaliDisplay(
                    input.value
                );
        }

        return display;
    }

    /**
     * Initialize the official JalaliDatePicker library.
     */
    function configureLibrary() {

        if (!isLibraryReady()) {

            logError(
                'jalalidatepicker.min.js must be loaded ' +
                'before jalali-picker.js.'
            );

            return false;
        }

        /*
         * The official library reads these values
         * from the attributes on each input:
         *
         * data-jdp-target-value-input
         * data-jdp-target-value-type
         *
         * No extra options needed — attributes are read directly.
         */
        root.jalaliDatepicker.startWatch();

        return true;
    }

    /**
     * Convert all existing data-jalali inputs
     * to JalaliDatePicker display inputs.
     */
    function attachLegacyInputs() {

        var inputs =
            document.querySelectorAll(
                LEGACY_SELECTOR
            );

        Array.prototype.forEach.call(
            inputs,
            function (input) {

                /*
                 * Do not process generated
                 * display inputs.
                 */
                if (
                    input.hasAttribute(
                        DISPLAY_ATTRIBUTE
                    )
                ) {
                    return;
                }

                /*
                 * If it already uses data-jdp,
                 * leave it alone.
                 */
                if (
                    !input.hasAttribute(
                        'data-jdp'
                    )
                ) {
                    attach(input);
                }

            }
        );
    }

    /**
     * Synchronize a visible Jalali input
     * after the backend/Gregorian input
     * has been changed programmatically.
     */
    function syncDisplayFromBackendInput(input) {

        if (!input) {
            return;
        }

        var display =
            input.nextElementSibling;

        if (
            !display ||
            !display.hasAttribute(
                DISPLAY_ATTRIBUTE
            )
        ) {
            return;
        }

        display.value =
            gregorianToJalaliDisplay(
                input.value
            );
    }

    var JalaliPicker = {

        /**
         * Initialize all date inputs.
         */
        init: function () {

            if (!isLibraryReady()) {

                logError(
                    'jalalidatepicker is not available. ' +
                    'Load jalalidatepicker.min.js ' +
                    'before jalali-picker.js.'
                );

                return false;
            }

            /*
             * Convert legacy data-jalali
             * inputs first.
             */
            attachLegacyInputs();

            /*
             * Initialize the official picker
             * only once.
             */
            if (!initialized) {

                configureLibrary();

                initialized = true;
            }

            return true;
        },

        /**
         * Attach the picker to a specific input.
         *
         * Example:
         *
         * JalaliPicker.attachById(
         *     'order-date'
         * );
         */
        attachById: function (id) {

            if (!isLibraryReady()) {

                logError(
                    'jalalidatepicker is not available. ' +
                    'Load jalalidatepicker.min.js ' +
                    'before jalali-picker.js.'
                );

                return null;
            }

            var input =
                document.getElementById(id);

            if (!input) {

                logError(
                    'Input not found: #' + id
                );

                return null;
            }

            var display;

            /*
             * If the input already uses
             * data-jdp, use it directly.
             */
            if (
                input.hasAttribute(
                    'data-jdp'
                )
            ) {

                display = input;

            } else {

                display = attach(input);

            }

            if (!initialized) {

                configureLibrary();

                initialized = true;

            }

            return display;
        },

        /**
         * Refresh a display input after
         * its Gregorian/backend value changes.
         *
         * Example:
         *
         * JalaliPicker.sync('order-date');
         */
        sync: function (id) {

            var input =
                document.getElementById(id);

            if (!input) {
                return false;
            }

            syncDisplayFromBackendInput(
                input
            );

            return true;
        },

        /**
         * Start the official JalaliDatePicker
         * manually.
         */
        start: function () {

            if (!isLibraryReady()) {

                logError(
                    'jalalidatepicker is not loaded.'
                );

                return false;
            }

            if (!initialized) {

                configureLibrary();

                initialized = true;

            }

            return true;
        }

    };

    /*
     * Expose public API.
     */
    root.JalaliPicker =
        JalaliPicker;

    /**
     * Automatic initialization after DOM
     * is ready.
     */
    function autoInit() {

        if (
            document.querySelector(
                LEGACY_SELECTOR
            ) ||
            document.querySelector(
                LIBRARY_SELECTOR
            )
        ) {

            JalaliPicker.init();

        }

    }

    if (
        document.readyState ===
        'loading'
    ) {

        document.addEventListener(
            'DOMContentLoaded',
            autoInit
        );

    } else {

        autoInit();

    }

})(typeof window !== 'undefined'
    ? window
    : this);