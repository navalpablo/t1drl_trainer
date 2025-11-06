# T1-Dark Rim Lesion Training Platform

An interactive web-based training resource for standardizing identification of T1-dark rim lesions (T1-DRLs) in multiple sclerosis.

## About

T1-dark rim lesions are a recently described MRI sign for chronic active inflammation in multiple sclerosis, visible on routine 3D T1-weighted sequences ([Naval-Baudin et al., European Journal of Radiology, 2024](https://doi.org/10.1016/j.ejrad.2024.111358)).

This platform provides approximately 400 expert-labeled training cases organized into:
- **5 guided training batches** with immediate feedback
- **15 self-evaluation batches** with performance metrics

All cases were labeled through a rigorous two-stage consensus process by experienced neuroradiologists.

## Access the Platform

**Live interactive platform:** [https://pnavalbaudin.github.io/t1drl-training/](https://pnavalbaudin.github.io/t1drl-training/)

No installation required. Works on desktop and mobile devices.

## How to Use

1. **Start with guided training** (batches 1-5) to learn the T1-DRL criteria with labeled examples
2. **Test yourself** with self-evaluation batches (6-20) and receive immediate scoring
3. **Track your progress** with built-in analytics stored locally in your browser

## Dataset Details

- **~400 lesion cases** with expert consensus labels (true T1-DRL vs. false positive)
- **Multiple consecutive MRI slices** per lesion (median 5 slices, range 3-11)
- **Segmentation masks** for lesion localization
- **3T MRI data** from standardized protocol (Philips 3T, 1mm sagittal 3D T1-TFE)

## License

### Code
The website code (HTML, CSS, JavaScript) is licensed under the [MIT License](LICENSE).

### Data
The MRI images and consensus labels are licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).

You may use, adapt, and share this dataset for any purpose, including commercial use, provided you give appropriate credit.

## Citation

If you use this training platform in your research or clinical work, please cite:

**Dataset:**
> Naval-Baudin P, Pons-Escoda A, et al. (2025). T1-Dark Rim Lesion Training Platform. 
> [Dataset DOI pending]

**Original T1-DRL paper:**
> Naval-Baudin P, Pons-Escoda A, Castillo-Pinar A, et al. (2024). The T1-dark-rim: A novel imaging sign for detecting smoldering inflammation in multiple sclerosis. European Journal of Radiology, 173, 111358. 
> https://doi.org/10.1016/j.ejrad.2024.111358

**Data descriptor paper:** *In preparation*

## Acknowledgments

This dataset was developed as part of the MSPredict project, funded by Fundación "la Caixa" (CaixaImpulse grant CI24-10486). 

The training platform supports the MAGNIMS multi-center validation study of T1-dark rim lesions.

Data collection and consensus labeling were approved by the Hospital Universitari de Bellvitge Research Ethics Committee.

## Contributing

### Reporting Issues
Found a bug or incorrect label? Please [open an issue](https://github.com/pnavalbaudin/t1drl-training/issues).

### Providing Feedback
We welcome feedback on the training platform's usability and effectiveness. Contact: pablo.naval.idi@gencat.cat

## Technical Details

- **Framework:** Vanilla HTML5, CSS3, JavaScript (no dependencies)
- **Storage:** Local browser storage (localStorage) for user analytics
- **Privacy:** No server-side data collection
- **Compatibility:** Modern browsers (Chrome, Firefox, Safari, Edge)

## Project Status

- ✅ IRB approved
- ✅ Platform publicly accessible
- 🔄 Data descriptor manuscript in preparation
- 🔄 Zenodo archival pending

## Related Projects

- [MSPredict](https://github.com/pnavalbaudin/MSPredict): Longitudinal MS biomarker study (parent cohort)
- MAGNIMS T1-DRL validation study (ongoing)

## Authors

**Pablo Naval-Baudin** - Concept, dataset curation, platform development  
Hospital Universitari de Bellvitge, Barcelona, Spain

**Albert Pons-Escoda** - Expert consensus, methodology  
Hospital Universitari de Bellvitge, Barcelona, Spain

*Full author list in forthcoming publications*

## Contact

Pablo Naval-Baudin  
Email: pablo.naval.idi@gencat.cat  
Hospital Universitari de Bellvitge  
Barcelona, Spain

---

**Last updated:** January 2025