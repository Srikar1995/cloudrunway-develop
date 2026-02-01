/**
 * @fileoverview Value Help Service for fetching contact persons and employees
 * @module control/ValueHelpService
 */
sap.ui.define([], function () {
  "use strict";

  const ValueHelpService = {
    // Cache for resolved entities
    _cache: {},

    /**
     * Fetches contact persons from the API
     * @param {string} sSearch - Optional search term
     * @param {string} sAccountId - Optional account ID for filtering
     * @returns {Promise<Array>} Array of contact person objects
     */
    fetchContactPersons: async function (sSearch, sAccountId) {
      try {
        let sUrl = "/sapsalesservicecloudv2/contact-person-service/contactPersons?$top=200";

        // Add accountid filter if available (only eq operator works)
        if (sAccountId) {
          sUrl += `&$filter=accountId eq '${sAccountId}'`;
        }

        const res = await fetch(sUrl, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const oData = await res.json();
        // Handle both array and object with results property
        let aResults = Array.isArray(oData) ? oData : oData.value || oData.results || [];

        // Apply client-side filtering if search term provided
        if (sSearch) {
          aResults = this._filterResults(aResults, sSearch);
        }

        // Cache the results
        aResults.forEach((oItem) => {
          if (oItem.id) {
            const sCacheKey = this._getCacheKey("contactPerson", oItem.id);
            this._cache[sCacheKey] = oItem;
          }
        });

        return aResults;
      } catch (err) {
        console.error("Error fetching contact persons:", err);
        throw err;
      }
    },

    /**
     * Fetches employees from the API
     * @param {string} sSearch - Optional search term
     * @returns {Promise<Array>} Array of employee objects
     */
    fetchEmployees: async function (sSearch) {
      try {
        const sUrl = "/sapsalesservicecloudv2/employee-service/employees";

        const res = await fetch(sUrl, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const oData = await res.json();
        // Handle both array and object with results property
        let aResults = Array.isArray(oData) ? oData : oData.value || oData.results || [];

        // Apply client-side filtering if search term provided
        if (sSearch) {
          aResults = this._filterResults(aResults, sSearch);
        }

        // Cache the results
        aResults.forEach((oItem) => {
          if (oItem.id) {
            const sCacheKey = this._getCacheKey("employee", oItem.id);
            this._cache[sCacheKey] = oItem;
          }
        });

        return aResults;
      } catch (err) {
        console.error("Error fetching employees:", err);
        throw err;
      }
    },

    /**
     * Resolves a contact person ID to full object
     * @param {string} sId - Contact person ID
     * @param {string} sAccountId - Optional account ID for filtering
     * @returns {Promise<Object>} Contact person object
     */
    resolveContactPersonById: async function (sId, sAccountId) {
      if (!sId) {
        return null;
      }

      // Check cache first
      const sCacheKey = this._getCacheKey("contactPerson", sId);
      if (this._cache[sCacheKey]) {
        return this._cache[sCacheKey];
      }

      try {
        // Try to fetch by ID
        const sUrl = `/sapsalesservicecloudv2/contact-person-service/contactPersons/${sId}`;
        const res = await fetch(sUrl, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (res.ok) {
          const oData = await res.json();
          // Handle response wrapped in 'value' node
          const oResult = oData.value || oData;
          this._cache[sCacheKey] = oResult;
          return oResult;
        }

        // If direct fetch fails, search for it
        const aResults = await this.fetchContactPersons(null, sAccountId);
        const oFound = aResults.find((oItem) => oItem.id === sId || oItem.displayId === sId);
        if (oFound) {
          this._cache[sCacheKey] = oFound;
          return oFound;
        }

        return null;
      } catch (err) {
        console.error("Error resolving contact person by ID:", err);
        return null;
      }
    },

    /**
     * Resolves an employee ID to full object
     * @param {string} sId - Employee ID
     * @returns {Promise<Object>} Employee object
     */
    resolveEmployeeById: async function (sId) {
      if (!sId) {
        return null;
      }

      // Check cache first
      const sCacheKey = this._getCacheKey("employee", sId);
      if (this._cache[sCacheKey]) {
        return this._cache[sCacheKey];
      }

      try {
        // Try to fetch by ID
        const sUrl = `/sapsalesservicecloudv2/employee-service/employees/${sId}`;
        const res = await fetch(sUrl, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (res.ok) {
          const oData = await res.json();
          // Handle response wrapped in 'value' node
          const oResult = oData.value || oData;
          this._cache[sCacheKey] = oResult;
          return oResult;
        }

        // If direct fetch fails, search for it
        const aResults = await this.fetchEmployees(null);
        const oFound = aResults.find(
          (oItem) => oItem.id === sId || oItem.employeeDisplayId === sId || oItem.displayId === sId
        );
        if (oFound) {
          this._cache[sCacheKey] = oFound;
          return oFound;
        }

        return null;
      } catch (err) {
        console.error("Error resolving employee by ID:", err);
        return null;
      }
    },

    /**
     * Filters results client-side based on search term
     * @param {Array} aResults - Array of results to filter
     * @param {string} sSearch - Search term
     * @returns {Array} Filtered array
     * @private
     */
    _filterResults: function (aResults, sSearch) {
      if (!sSearch || !aResults || aResults.length === 0) {
        return aResults;
      }

      const sSearchLower = sSearch.toLowerCase();
      return aResults.filter(function (oItem) {
        const sName = (oItem.formattedName || "").toLowerCase();
        const sEmail = (oItem.eMail || oItem.workplaceAddress?.eMail || "").toLowerCase();
        return sName.includes(sSearchLower) || sEmail.includes(sSearchLower);
      });
    },

    /**
     * Generates a cache key for storing resolved entities
     * @param {string} sType - Type: 'contactPerson' or 'employee'
     * @param {string} sId - Entity ID
     * @returns {string} Cache key
     * @private
     */
    _getCacheKey: function (sType, sId) {
      return `${sType}_${sId}`;
    },

    /**
     * Clears the cache (useful for testing or memory management)
     */
    clearCache: function () {
      this._cache = {};
    },
  };

  return ValueHelpService;
});
